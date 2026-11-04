import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { installSoakSeed } from './helpers/gameplaySoakHarness';

const onnxPath = new URL('../../public/models/badugi_beginner_controller_v2_20261104.onnx', import.meta.url).pathname;
const onnxBytes = readFileSync(onnxPath);
const onnxSha256 = createHash('sha256').update(onnxBytes).digest('hex');
const modelId = 'model-badugi-beginner-controller-v2-20261104';

for (const [mode, entrants] of [['cash', 6], ['tournament', 2], ['tournament', 3], ['tournament', 6]] as const) {
  test(`registered D03 Beginner model is used by real ${mode} ${entrants}-seat controller`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installSoakSeed(page, mode === 'cash' ? 2026110401 : 2026110400 + entrants);
    await page.route('**/api/**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 9303, username: 'QA Hero', email: 'qa@mgx-e2e.test' }),
    }));
    await page.addInitScript(() => {
      localStorage.setItem('mgx.previewVariants', 'true');
      localStorage.setItem('dev.aiTierOverride', 'beginner');
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
        id: 'd03-v2-candidate-runtime', name: 'D03 v2 Candidate Runtime',
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
    const target = rows.filter(row => row.actorSeat !== 0 && ['BET', 'DRAW'].includes(row.phase));
    const others = rows.filter(row => row.actorSeat === 0 && ['BET', 'DRAW'].includes(row.phase));
    await writeFile(testInfo.outputPath('d03-v2-beginner-production-runtime.json'),
      JSON.stringify({ mode, entrants, onnxSha256, modelId, hands, target, others, errors }, null, 2));
    expect(errors).toEqual([]);
    expect(target.length).toBeGreaterThan(0);
    expect(target.some(row => row.phase === 'BET')).toBe(true);
    expect(target.some(row => row.phase === 'DRAW')).toBe(true);
    expect(target.every(row => row.inferenceTrace?.status === 'used' &&
      row.inferenceTrace?.usedModelId === modelId &&
      row.inferenceTrace?.elapsedMs < 8000)).toBe(true);
    expect(others).toEqual([]);
    expect(target.filter(row => row.phase === 'BET').every(row =>
      row.legalActions?.some(action =>
        String(action).toLowerCase() === String(row.finalAction).toLowerCase()))).toBe(true);
    expect(hands.flatMap(hand => hand.events).filter(event => event.type === 'DRAW_ACTION')
      .every(event => Number.isInteger(event.drawCount) && event.drawCount >= 0 && event.drawCount <= 4)).toBe(true);
  });
}

test('registered D03 Beginner model times out into a legal real-controller fallback',
  async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await installSoakSeed(page, 2026110403);
    let delayed = false;
    await page.route('**/models/badugi_beginner_controller_v2_20261104.onnx', async route => {
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
      localStorage.setItem('dev.aiTierOverride', 'beginner');
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
      .filter(row => row.actorSeat !== 0 && ['BET', 'DRAW'].includes(row.phase));
    await writeFile(testInfo.outputPath('d03-v2-beginner-production-timeout.json'),
      JSON.stringify({ onnxSha256, handId: hand.handId, chipDelta, target }, null, 2));
    expect(delayed).toBe(true);
    expect(target.some(row => row.inferenceTrace?.status === 'fallback' &&
      row.inferenceTrace?.reason === 'inference-timeout' &&
      row.inferenceTrace?.usedModelId === null)).toBe(true);
    expect(target.filter(row => row.phase === 'BET').every(row =>
      row.legalActions?.some(action =>
        String(action).toLowerCase() === String(row.finalAction).toLowerCase()))).toBe(true);
  });
