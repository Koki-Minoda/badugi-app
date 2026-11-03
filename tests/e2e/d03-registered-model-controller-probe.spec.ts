import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';

// This is an isolated wiring probe. It never changes the shipped tier policy or proves strength.
const MODELS = {
  beginner: 'model-badugi-sixmax-standard-dqn-v2',
  standard: 'model-badugi-sixmax-standard-e11',
  pro: 'model-badugi-pro-v1',
  iron: 'model-badugi-iron-v1',
  worldmaster: 'model-badugi-worldmaster-v1',
} as const;

function forceRegisteredOnnxInTest(source: string) {
  const guard = 'const shouldUseOnnx = onnxTier === "beginner" || onnxTier === "standard";';
  expect(source.split(guard)).toHaveLength(3);
  let patched = source.replaceAll(guard, 'const shouldUseOnnx = true;');
  const overlay = /activeAiTierConfig\?\.id === "pro"(\s*\?\s*chooseProAction\()/g;
  expect([...patched.matchAll(overlay)]).toHaveLength(2);
  patched = patched.replace(overlay, 'false$1');
  return patched;
}

for (const [tier, expectedModelId] of Object.entries(MODELS)) {
  for (const mode of ['cash', 'tournament'] as const) {
    test(`D03 ${tier} registered ONNX completes a ${mode} controller hand in isolation`, async ({ page }, testInfo) => {
      test.setTimeout(150000);
      let patchedApp = 0;
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/src/ui/App.jsx*', async route => {
        const response = await route.fetch();
        const body = await response.text();
        patchedApp += 1;
        await route.fulfill({ response, body: tier === 'beginner' || tier === 'standard'
          ? body : forceRegisteredOnnxInTest(body) });
      });
      await page.route('**/api/**', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 9303, username: 'QA Hero', email: 'qa@mgx-e2e.test' }),
      }));
      await page.addInitScript(tierId => {
        localStorage.setItem('mgx.previewVariants', 'true');
        localStorage.setItem('dev.aiTierOverride', tierId);
        localStorage.setItem('mgx_auth', JSON.stringify({
          accessToken: 'test', tokenType: 'Bearer',
          user: { id: 9303, username: 'QA Hero' }, isAuthenticated: true,
        }));
        window.__MGX_CPU_DECISION_TRACE__ = [];
      }, tier);
      await page.goto(`${APP_URL}?variant=D03&mode=cash&mgxQa=mobile`);
      await enterTitleIfPresent(page);
      await page.getByTestId('menu-ring').click();
      await selectGameVariantFromSelector(page, 'badugi');
      await waitForE2EDriver(page);
      if (mode === 'tournament') {
        await invokeE2E(page, 'startTournamentMTT', {
          id: `d03-${tier}-model-probe`, name: 'D03 Registered Model Probe',
          tables: 1, seatsPerTable: 6, totalPlayers: 6, startingStack: 2000,
          gameVariant: 'badugi', gameRotation: ['badugi'], rotationPolicy: 'fixed',
          levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
          payouts: [{ place: 1, percent: 100 }],
        });
        await expect(page.getByTestId('tournament-hud')).toBeVisible();
      }
      await page.evaluate(() => { window.__MGX_CPU_DECISION_TRACE__ = []; });
      for (let step = 0; step < 120; step += 1) {
        const progress = await getProgressState(page);
        if (progress.isTerminal) break;
        const action = await performSafeAction(page, { autoCpu: true, policy: 'heroStay' });
        if (!action.acted && action.reason === 'terminal') break;
        expect(action.acted, JSON.stringify(action)).toBe(true);
      }
      await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
      await expect.poll(() => page.evaluate(() => {
        const currentId = window.__BADUGI_E2E__.getStateSnapshot().handId;
        return window.__BADUGI_E2E__.getHandHistory().some(record => record.handId === currentId
          && record.events?.some(event => event.type === 'HAND_END'));
      })).toBe(true);
      const evidence = await page.evaluate(() => {
        const currentId = window.__BADUGI_E2E__.getStateSnapshot().handId;
        const hand = [...window.__BADUGI_E2E__.getHandHistory()].reverse().find(record =>
          record.handId === currentId && record.events?.some(event => event.type === 'HAND_END'));
        return { rows: window.__MGX_CPU_DECISION_TRACE__ ?? [], hand };
      });
      const used = evidence.rows.filter(row => row.inferenceTrace?.status === 'used');
      const invalid = evidence.rows.filter(row => row.illegalActionRejected
        || ['failed', 'fallback'].includes(row.inferenceTrace?.status));
      const finalStacks = evidence.hand.events.find(event => event.type === 'HAND_END').finalStacks;
      const stackDeltas = evidence.hand.seats.map(seat => ({
        seat: seat.seat,
        delta: finalStacks.find(entry => entry.seat === seat.seat)?.stack - seat.startStack,
      }));
      const report = {
        sourceHead: process.env.GITHUB_SHA ?? null,
        tier, mode, apiStubbed: true,
        testOnlyAppPatch: tier !== 'beginner' && tier !== 'standard',
        expectedModelId, patchedApp, handId: evidence.hand.handId,
        decisions: evidence.rows.length, used: used.length,
        nonModelDecisions: evidence.rows.length - used.length,
        phases: [...new Set(used.map(row => row.phase))],
        traceStatuses: evidence.rows.map(row => ({
          seat: row.actorSeat, phase: row.phase, action: row.finalAction,
          legalActions: row.legalActions ?? [],
          decisionSource: row.decisionSource ?? null,
          modelId: row.modelId ?? null,
          rlRequestSent: row.rlRequestSent ?? null,
          status: row.inferenceTrace?.status ?? null,
          usedModelId: row.inferenceTrace?.usedModelId ?? null,
          reason: row.inferenceTrace?.reason ?? null,
        })),
        stackDeltas, pageErrors,
      };
      await writeFile(testInfo.outputPath('d03-model-probe.json'), JSON.stringify(report, null, 2));
      await testInfo.attach('d03-registered-model-controller-probe', {
        body: JSON.stringify(report, null, 2), contentType: 'application/json',
      });
      expect(patchedApp).toBeGreaterThan(0);
      expect(pageErrors).toEqual([]);
      expect(used.length).toBeGreaterThan(0);
      expect(used).toHaveLength(evidence.rows.length);
      expect(used.every(row => row.inferenceTrace.usedModelId === expectedModelId)).toBe(true);
      if (tier === 'worldmaster' && mode === 'tournament') {
        const firstDraw = used.findIndex(row => row.phase === 'DRAW');
        expect(firstDraw).toBeGreaterThanOrEqual(0);
        expect(used.slice(firstDraw + 1).some(row => row.phase === 'BET'
          && String(row.finalAction).toLowerCase() === 'raise')).toBe(true);
      }
      expect(used.every(row => row.phase === 'DRAW'
        ? (/^draw\([0-4]\)$/i.test(String(row.finalAction)) || String(row.finalAction).toLowerCase() === 'pat')
          && row.legalActions?.some(action => /^draw/i.test(String(action)))
        : row.legalActions?.some(action =>
          String(action).toLowerCase() === String(row.finalAction).toLowerCase())),
      JSON.stringify(report.traceStatuses)).toBe(true);
      expect(invalid).toEqual([]);
      expect(stackDeltas.every(entry => Number.isFinite(entry.delta))).toBe(true);
      expect(stackDeltas.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
    });
  }
}
