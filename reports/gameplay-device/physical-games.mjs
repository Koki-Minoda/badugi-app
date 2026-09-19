import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { listVariantProfiles } from '../../src/games/config/variantProfiles.js';
import { VARIANT_AVAILABILITY } from '../../src/games/config/variantAvailability.js';
import { validateReplayReadyHandHistory } from '../../src/ui/utils/handHistoryReplayRequirements.js';

export async function auditPhysicalGames(c, { ids = [], email, password } = {}) {
  const rows = [];
  const save = () => writeFile(new URL('./artifacts/physical-games.json', import.meta.url), JSON.stringify({ updated: new Date().toISOString(), interaction: 'DOM clicks with center hit testing; no native touch/keyboard', rows, errors: c.errors, fixtureErrors: c.fixtureErrors }, null, 2));
  const clickId = async id => c.until(id => {
    const e = document.querySelector(`[data-testid="${id}"]`);
    if (!e || e.disabled || !e.getClientRects().length) return false;
    e.scrollIntoView({ block: 'center', inline: 'center' });
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !e.contains(hit)) return false;
    e.click(); return true;
  }, id);
  for (const profile of listVariantProfiles()) {
    const id = profile.engineKey;
    if (!VARIANT_AVAILABILITY[id] || ['ofc', 'chinese_poker'].includes(id) || (ids.length && !ids.includes(id))) continue;
    const row = { id, profileId: profile.id, status: 'RUNNING', heroActions: [], started: new Date().toISOString() };
    rows.push(row); await save();
    try {
      await c.navigate('/');
      await c.evaluate(() => localStorage.setItem('mgx.previewVariants', 'true'));
      await clickId('title-enter-button');
      await c.until(() => !!document.querySelector('[data-testid=menu-ring],[data-testid=auth-email]'));
      if (await c.evaluate(() => !!document.querySelector('[data-testid=auth-email]'))) {
        assert.ok(email && password, 'Test account credentials required for login');
        await c.field('Email', email); await c.field('Password', password); await c.click('Login', 'form');
        row.loginRequired = true;
      }
      await clickId('menu-ring');
      await c.until(() => !!document.querySelector('input[type=search]'));
      await c.evaluate(value => {
        const e = document.querySelector('input[type=search]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, value);
        e.dispatchEvent(new Event('input', { bubbles: true }));
      }, profile.id);
      await clickId(`game-selector-play-${id}`);
      const start = await c.until(() => {
        const gate = document.body.innerText.includes('横向きでプレイしてください');
        const state = window.__BADUGI_E2E__?.getStateSnapshot?.();
        return gate || state?.handId ? { gate, variant: state?.gameVariant, width: innerWidth, height: innerHeight } : false;
      });
      row.viewport = { width: start.width, height: start.height };
      if (start.gate) { row.status = 'LANDSCAPE_REQUIRED'; await save(); console.log(id, row.status); continue; }
      const before = await c.evaluate(() => JSON.parse(localStorage.getItem('badugi.history.hands') || '[]').map(h => h.handId));
      const deadline = Date.now() + 180000;
      let lastDrawKey = '';
      while (Date.now() < deadline) {
        const s = await c.evaluate(() => {
          const st = window.__BADUGI_E2E__?.getStateSnapshot?.();
          const visible = e => e && !e.disabled && e.getClientRects().length > 0;
          return { phase: st?.phase, drawRound: st?.drawRoundIndex ?? st?.drawRound, handId: st?.handId, result: visible(document.querySelector('[data-testid=hand-result-overlay]')), actions: ['action-check', 'action-call', 'action-draw-selected', 'action-raise'].filter(id => visible(document.querySelector(`[data-testid="${id}"]`))) };
        });
        if (s.result) break;
        const action = s.actions[0];
        if (action) {
          if (action === 'action-draw-selected') {
            const key = `${s.handId}:${s.drawRound}`;
            if (key !== lastDrawKey) { await clickId('player-0-card-0'); lastDrawKey = key; }
          }
          await clickId(action); row.heroActions.push(action);
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await c.until(() => !!document.querySelector('[data-testid=hand-result-overlay]'));
      assert.ok(row.heroActions.length, 'At least one hero action must use a visible control');
      row.result = await c.evaluate(() => ({ headline: document.querySelector('[data-testid=hand-result-overlay] h2')?.textContent, parts: [...document.querySelectorAll('[data-testid=hand-result-pot-amount]')].map(e => e.textContent), overflow: document.documentElement.scrollWidth - innerWidth }));
      const histories = await c.until(before => {
        const records = JSON.parse(localStorage.getItem('badugi.history.hands') || '[]').filter(h => !before.includes(h.handId));
        return records.length ? records : false;
      }, before);
      row.records = histories.map(h => ({ handId: h.handId, variantId: h.variantId, replay: validateReplayReadyHandHistory(h, { variantId: h.variantId }) }));
      assert.ok(row.records.every(h => h.replay.valid), 'History must contain replay fields');
      assert.ok(row.result.overflow <= 2, 'No horizontal overflow');
      await c.shot(`physical-${id}-result`);
      await clickId('hand-result-cash-out');
      await c.click('Game Select');
      await c.until(() => !!document.querySelector('input[type=search]'));
      row.status = 'PASS';
    } catch (error) {
      row.error = String(error);
      if (/Runtime\.|Page\.|WebSocket/.test(row.error) && /timed out|closed/.test(row.error)) {
        row.status = 'DEVICE_CONNECTION_BLOCKED'; await save(); break;
      }
      row.status = 'FAIL';
      try { await c.shot(`physical-${id}-failure`); } catch {}
    }
    await save(); console.log(id, row.status, row.error || '');
  }
  return rows;
}
