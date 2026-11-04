import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { installSoakSeed } from './helpers/gameplaySoakHarness';

const onnxPath = '/Users/koki/Documents/Codex/MGX-RL-Artifacts/d03-v2-standard-cash25-mtt75-onnx-exploratory-20261105/candidate.onnx';
const onnxBytes = readFileSync(onnxPath);
const onnxSha256 = createHash('sha256').update(onnxBytes).digest('hex');
const modelId = 'isolated-d03-v2-standard-mode-candidate';

function injectCandidate(source: string) {
  const originalTier = 'const onnxTier = activeAiTierConfig?.id;';
  if (source.split(originalTier).length !== 3) throw new Error('D03 tier sites changed');
  let patched = `import {
    inferBadugiControllerV2StandardCandidateBet,
    inferBadugiControllerV2StandardCandidateDraw,
  } from '../ai/evaluation/badugiControllerV2StandardCandidateInference.js';\n${source}`;
  patched = patched.replace(originalTier,
    'const onnxTier = seatToAct === 1 ? "standard" : "teacher";');
  patched = patched.replace(originalTier,
    'const onnxTier = activeSeat === 1 ? "standard" : "teacher";');
  // Standard currently uses the legacy route in production. Override only this
  // isolated browser test so the candidate receives the v2 observation.
  patched = patched.replaceAll('onnxTier === "beginner"', 'onnxTier === "standard"');
  for (const [oldName, newName] of [
    ['? inferBadugiBeginnerControllerV2Draw', '? inferBadugiControllerV2StandardCandidateDraw'],
    ['? inferBadugiBeginnerControllerV2Bet', '? inferBadugiControllerV2StandardCandidateBet'],
  ]) {
    if (patched.split(oldName).length !== 2) throw new Error(`D03 inference site changed: ${oldName}`);
    patched = patched.replace(oldName, newName);
  }
  return patched;
}

for (const [mode, entrants] of [['cash', 6], ['tournament', 2], ['tournament', 3], ['tournament', 6]] as const) {
  test(`isolated trained D03 v2 Standard ONNX is used by real ${mode} ${entrants} controller`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installSoakSeed(page, mode === 'cash' ? 2026110501 : 2026110500 + entrants);
    await page.route('**/src/ui/App.jsx*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: injectCandidate(await response.text()) });
    });
    await page.route('**/__d03_v2_standard_candidate.onnx', route => route.fulfill({
      status: 200, contentType: 'application/octet-stream', body: onnxBytes,
    }));
    await page.route('**/api/**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 9303, username: 'QA Hero', email: 'qa@mgx-e2e.test' }),
    }));
    await page.addInitScript(() => {
      localStorage.setItem('mgx.previewVariants', 'true');
      localStorage.setItem('dev.aiTierOverride', 'standard');
      localStorage.setItem('mgx_auth', JSON.stringify({
        accessToken: 'test', tokenType: 'Bearer',
        user: { id: 9303, username: 'QA Hero' }, isAuthenticated: true,
      }));
      window.__MGX_CPU_DECISION_TRACE__ = [];
    });
    await page.goto(`${APP_URL}?variant=D03&mode=cash&mgxQa=mobile`);
    await enterTitleIfPresent(page);
    await page.getByTestId('menu-ring').click();
    await selectGameVariantFromSelector(page, 'badugi');
    await waitForE2EDriver(page);
    if (mode === 'tournament') {
      await invokeE2E(page, 'startTournamentMTT', {
        id: 'd03-v2-standard-candidate-runtime', name: 'D03 v2 Candidate Runtime',
        tables: 1, seatsPerTable: 6, totalPlayers: entrants, startingStack: 2000,
        gameVariant: 'badugi', gameRotation: ['badugi'], rotationPolicy: 'fixed',
        levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
      await expect(page.getByTestId('tournament-hud')).toBeVisible();
    }
    const hands = [];
    for (let handIndex = 0; handIndex < 3; handIndex += 1) {
      for (let step = 0; step < 120; step += 1) {
        const progress = await getProgressState(page);
        if (progress.isTerminal) break;
        const action = await performSafeAction(page, { autoCpu: true, policy: 'heroStay' });
        if (!action.acted && action.reason === 'terminal') break;
        expect(action.acted, JSON.stringify(action)).toBe(true);
      }
      const hand = await page.evaluate(() => {
        const id = window.__BADUGI_E2E__.getStateSnapshot().handId;
        return [...window.__BADUGI_E2E__.getHandHistory()].reverse().find(record =>
          record.handId === id && record.events?.some(event => event.type === 'HAND_END'));
      });
      expect(hand).toBeTruthy();
      const finalStacks = hand.events.find(event => event.type === 'HAND_END').finalStacks;
      const chipDelta = hand.seats.map(seat =>
        Number(finalStacks.find(entry => entry.seat === seat.seat)?.stack) - Number(seat.startStack));
      expect(chipDelta.reduce((sum, value) => sum + value, 0)).toBe(0);
      hands.push({ handId: hand.handId, chipDelta,
        events: hand.events.filter(event => event.type === 'BET_ACTION' || event.type === 'DRAW_ACTION')
          .map(event => ({ type: event.type, seat: event.seat, action: event.action,
            amount: event.amount, drawCount: event.drawCount,
            stackBefore: event.stackBefore, stackAfter: event.stackAfter })) });
      if (mode === 'tournament') {
        const hud = await page.evaluate(() => window.__BADUGI_E2E__.getTournamentHudState());
        if (hud?.isFinished || hud?.heroBusted) break;
      }
      if (handIndex < 2) {
        await page.getByRole('button', { name: /next hand|次のハンド/i }).first().click();
        await expect.poll(() => page.evaluate(() =>
          window.__BADUGI_E2E__.getStateSnapshot().handId)).not.toBe(hand.handId);
      }
    }
    const rows = await page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []);
    const target = rows.filter(row => row.actorSeat === 1 && ['BET', 'DRAW'].includes(row.phase));
    const others = rows.filter(row => row.actorSeat !== 1 && ['BET', 'DRAW'].includes(row.phase));
    await writeFile(testInfo.outputPath('d03-v2-standard-candidate-runtime.json'),
      JSON.stringify({ mode, entrants, onnxSha256, modelId, hands, target, others, errors }, null, 2));
    expect(errors).toEqual([]);
    expect(target.length).toBeGreaterThan(0);
    expect(target.some(row => row.phase === 'BET')).toBe(true);
    expect(target.some(row => row.phase === 'DRAW')).toBe(true);
    expect(target.every(row => row.inferenceTrace?.status === 'used' &&
      row.inferenceTrace?.usedModelId === modelId &&
      row.inferenceTrace?.tierId === 'standard' &&
      row.inferenceTrace?.elapsedMs < 8000)).toBe(true);
    expect(others.every(row => row.inferenceTrace?.status !== 'used')).toBe(true);
    expect(target.filter(row => row.phase === 'BET').every(row =>
      row.legalActions?.some(action =>
        String(action).toLowerCase() === String(row.finalAction).toLowerCase()))).toBe(true);
    expect(hands.flatMap(hand => hand.events).filter(event => event.type === 'DRAW_ACTION')
      .every(event => Number.isInteger(event.drawCount) && event.drawCount >= 0 && event.drawCount <= 4)).toBe(true);
  });
}

test('isolated D03 v2 candidate times out into a legal real-controller fallback',
  async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await installSoakSeed(page, 2026110503);
    await page.route('**/src/ui/App.jsx*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: injectCandidate(await response.text()) });
    });
    let delayed = false;
    await page.route('**/__d03_v2_standard_candidate.onnx', async route => {
      if (!delayed) {
        delayed = true;
        await new Promise(resolve => setTimeout(resolve, 9000));
      }
      await route.fulfill({ status: 200, contentType: 'application/octet-stream',
        body: onnxBytes });
    });
    await page.route('**/api/**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 9303, username: 'QA Hero', email: 'qa@mgx-e2e.test' }),
    }));
    await page.addInitScript(() => {
      localStorage.setItem('mgx.previewVariants', 'true');
      localStorage.setItem('dev.aiTierOverride', 'standard');
      localStorage.setItem('mgx_auth', JSON.stringify({
        accessToken: 'test', tokenType: 'Bearer',
        user: { id: 9303, username: 'QA Hero' }, isAuthenticated: true,
      }));
      window.__MGX_CPU_DECISION_TRACE__ = [];
    });
    await page.goto(`${APP_URL}?variant=D03&mode=cash&mgxQa=mobile`);
    await enterTitleIfPresent(page);
    await page.getByTestId('menu-ring').click();
    await selectGameVariantFromSelector(page, 'badugi');
    await waitForE2EDriver(page);
    for (let step = 0; step < 120; step += 1) {
      const progress = await getProgressState(page);
      if (progress.isTerminal) break;
      const action = await performSafeAction(page, { autoCpu: true, policy: 'heroStay' });
      if (!action.acted && action.reason === 'terminal') break;
      expect(action.acted, JSON.stringify(action)).toBe(true);
    }
    const hand = await page.evaluate(() => {
      const id = window.__BADUGI_E2E__.getStateSnapshot().handId;
      return [...window.__BADUGI_E2E__.getHandHistory()].reverse().find(record =>
        record.handId === id && record.events?.some(event => event.type === 'HAND_END'));
    });
    expect(hand).toBeTruthy();
    const finalStacks = hand.events.find(event => event.type === 'HAND_END').finalStacks;
    const chipDelta = hand.seats.map(seat =>
      Number(finalStacks.find(entry => entry.seat === seat.seat)?.stack) - Number(seat.startStack));
    expect(chipDelta.reduce((sum, value) => sum + value, 0)).toBe(0);
    const target = (await page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []))
      .filter(row => row.actorSeat === 1 && ['BET', 'DRAW'].includes(row.phase));
    await writeFile(testInfo.outputPath('d03-v2-standard-timeout-fallback.json'),
      JSON.stringify({ onnxSha256, handId: hand.handId, chipDelta, target }, null, 2));
    expect(delayed).toBe(true);
    expect(target.some(row => row.inferenceTrace?.status === 'fallback' &&
      row.inferenceTrace?.reason === 'inference-timeout' &&
      row.inferenceTrace?.usedModelId === null)).toBe(true);
    expect(target.filter(row => row.phase === 'BET').every(row =>
      row.legalActions?.some(action =>
        String(action).toLowerCase() === String(row.finalAction).toLowerCase()))).toBe(true);
  });
