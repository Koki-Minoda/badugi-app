import assert from 'node:assert/strict';
import {readSettledPhaseTone} from './phase-tone-check.mjs?settled=2';
import {measureMobileLayout} from './mobile-layout-check.mjs';
import { writeFile } from 'node:fs/promises';
import { listVariantProfiles } from '../../src/games/config/variantProfiles.js';
import { VARIANT_AVAILABILITY } from '../../src/games/config/variantAvailability.js';
import { validateReplayReadyHandHistory } from '../../src/ui/utils/handHistoryReplayRequirements.js';

export async function auditPhysicalGames(c, { ids = [], email, password, outputName = "physical-games", checkLayout = false } = {}) {
  const rows = [];
  const save = () => writeFile(new URL(`./artifacts/${outputName}.json`, import.meta.url), JSON.stringify({ updated: new Date().toISOString(), interaction: 'DOM clicks with center hit testing; no native touch/keyboard', rows, errors: c.errors, fixtureErrors: c.fixtureErrors }, null, 2));
  const clickId = async id => c.until(id => {
    const e = document.querySelector(`[data-testid="${id}"]`);
    if (!e || e.disabled || !e.getClientRects().length) return false;
    // Center-scrolling can scroll an overflow:hidden table on iOS.
    // Preserve the visible board; only reveal controls that are outside it.
    const before = e.getBoundingClientRect();
    if (before.top < 0 || before.bottom > innerHeight || before.left < 0 || before.right > innerWidth) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
      row.initialLayout = await c.evaluate(() => ({
        width: innerWidth, height: innerHeight,
        badges: [...document.querySelectorAll('[data-testid$="-draw-badge"]')].map(e => e.textContent),
        seats: [...document.querySelectorAll('[data-testid]')].filter(e => /^seat-\d+$/.test(e.dataset.testid) && e.getClientRects().length).map(e => { const r=e.getBoundingClientRect(); return {id:e.dataset.testid,x:r.x,y:r.y,width:r.width,height:r.height}; }),
      }));
      assert.equal(row.initialLayout.badges.length, 0, 'No draw badge before the first exchange');
      if(checkLayout){row.phaseTransitions=[];row.geometryChecks=0;row.maxHeroCards=0;row.maxBoardCards=0;await c.shot(`${outputName}-${id}-playing`);}
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
        if(checkLayout){const geometry=await c.evaluate(measureMobileLayout);row.geometryChecks++;
         const tone=await readSettledPhaseTone(c);assert.deepEqual(tone.issues,[]);
         if(tone.phase&&row.phaseTransitions.at(-1)?.phase!==tone.phase){row.phaseTransitions.push(tone);await c.shot(`${outputName}-${id}-phase-${tone.phase}-${row.phaseTransitions.length}`);}
         if((geometry.heroCards||0)>row.maxHeroCards||(geometry.boardCards||0)>row.maxBoardCards)await c.shot(`${outputName}-${id}-cards-${geometry.heroCards}-${geometry.boardCards}`);row.maxHeroCards=Math.max(row.maxHeroCards,geometry.heroCards||0);row.maxBoardCards=Math.max(row.maxBoardCards,geometry.boardCards||0);assert.deepEqual(geometry.issues,[],JSON.stringify(geometry));}
        const action = s.actions[0];
        if (action) {
          if (action === 'action-draw-selected') {
            const key = `${s.handId}:${s.drawRound}`;
            if (key !== lastDrawKey) { await clickId('player-0-card-0'); lastDrawKey = key; }
          }
          await clickId(action); row.heroActions.push(action); await save();
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
      await c.shot(`${outputName}-${id}-result`);
      await clickId('hand-result-cash-out');
      await c.until(() => { const e = [...document.querySelectorAll('button')].find(e => /^(ゲーム選択|Game Select)$/.test(e.textContent.trim()) && e.getClientRects().length); if (!e) return false; e.click(); return true; });
      await c.until(() => !!document.querySelector('input[type=search],[data-testid=menu-ring]'));
      row.status = 'PASS';
    } catch (error) {
      row.error = String(error);
      if (/Runtime\.|Page\.|WebSocket/.test(row.error) && /timed out|closed/.test(row.error)) {
        row.status = 'DEVICE_CONNECTION_BLOCKED'; await save(); break;
      }
      row.status = 'FAIL';
      try { await c.shot(`${outputName}-${id}-failure`); } catch {}
    }
    await save(); console.log(id, row.status, row.error || '');
  }
  return rows;
}
