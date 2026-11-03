import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';

// Served-source isolation for evaluation development. It does not change shipped routing.
function isolateSeatOne(source: string, modelTier: string | null, seats: number) {
  const drawTier = 'const onnxTier = activeAiTierConfig?.id;';
  expect(source.split(drawTier)).toHaveLength(3);
  let patched = source.replace(drawTier,
    `const onnxTier = seatToAct === 1 ? ${JSON.stringify(modelTier ?? 'teacher')} : "teacher";`);
  patched = patched.replace(drawTier,
    `const onnxTier = activeSeat === 1 ? ${JSON.stringify(modelTier ?? 'teacher')} : "teacher";`);
  const guard = 'const shouldUseOnnx = onnxTier === "beginner" || onnxTier === "standard";';
  expect(patched.split(guard)).toHaveLength(3);
  patched = patched.replaceAll(guard, 'const shouldUseOnnx = onnxTier !== "teacher";');
  const proOverlay = /activeAiTierConfig\?\.id === "pro"(\s*\?\s*chooseProAction\()/g;
  expect([...patched.matchAll(proOverlay)]).toHaveLength(2);
  patched = patched.replace(proOverlay, 'false$1');
  if (seats < 6) {
    const initialSeats = 'const [seatConfig, setSeatConfig] = useState(() => [...DEFAULT_SEAT_TYPES]);';
    expect(patched.split(initialSeats)).toHaveLength(2);
    const blueprint = ['HUMAN', ...Array(seats - 1).fill('CPU'), ...Array(6 - seats).fill('EMPTY')];
    patched = patched.replace(initialSeats,
      `const [seatConfig, setSeatConfig] = useState(() => ${JSON.stringify(blueprint)});`);
  }
  return patched;
}

const MODEL_IDS = {
  beginner: 'model-badugi-sixmax-standard-dqn-v2',
  standard: 'model-badugi-sixmax-standard-e11',
  pro: 'model-badugi-pro-v1',
  iron: 'model-badugi-iron-v1',
  worldmaster: 'model-badugi-worldmaster-v1',
} as const;

const CASES: Array<{ modelTier: null | keyof typeof MODEL_IDS; seats: number;
  mode: 'cash' | 'tournament'; handCount: number }> = [
  ...([null, ...Object.keys(MODEL_IDS)] as Array<null | keyof typeof MODEL_IDS>)
    .map(modelTier => ({ modelTier, seats: 6, mode: 'cash' as const, handCount: 2 })),
  { modelTier: 'standard', seats: 2, mode: 'cash', handCount: 2 },
  { modelTier: 'standard', seats: 3, mode: 'cash', handCount: 2 },
  { modelTier: 'standard', seats: 6, mode: 'tournament', handCount: 1 },
];

for (const { modelTier, seats, mode, handCount } of CASES) {
  test(`D03 ${modelTier ?? 'teacher'} seat-one isolation over ${handCount} ${mode} hands at ${seats} seats`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/ui/App.jsx*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: isolateSeatOne(await response.text(), modelTier, seats) });
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
    if (mode === 'tournament') {
      await invokeE2E(page, 'startTournamentMTT', {
        id: 'd03-seat-isolated-probe', name: 'D03 Seat Isolated Probe',
        tables: 1, seatsPerTable: 6, totalPlayers: 6, startingStack: 2000,
        gameVariant: 'badugi', gameRotation: ['badugi'], rotationPolicy: 'fixed',
        levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
      await expect(page.getByTestId('tournament-hud')).toBeVisible();
    }
    const hands: Array<{ handId: unknown; targetDelta: number; chipSum: number }> = [];
    for (let handIndex = 0; handIndex < handCount; handIndex += 1) {
      for (let step = 0; step < 120; step += 1) {
        const progress = await getProgressState(page);
        if (progress.isTerminal) break;
        const action = await performSafeAction(page, { autoCpu: true, policy: 'heroStay' });
        if (!action.acted && action.reason === 'terminal') break;
        expect(action.acted, JSON.stringify(action)).toBe(true);
      }
      await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
      const hand = await page.evaluate(() => {
        const currentId = window.__BADUGI_E2E__.getStateSnapshot().handId;
        return [...window.__BADUGI_E2E__.getHandHistory()].reverse().find(record =>
          record.handId === currentId && record.events?.some(event => event.type === 'HAND_END'));
      });
      expect(hand).toBeTruthy();
      const finalStacks = hand.events.find(event => event.type === 'HAND_END').finalStacks;
      const deltas = hand.seats.map(seat =>
        Number(finalStacks.find(entry => entry.seat === seat.seat)?.stack) - Number(seat.startStack));
      expect(deltas.every(Number.isFinite)).toBe(true);
      hands.push({ handId: hand.handId, targetDelta: deltas[1],
        chipSum: deltas.reduce((sum, value) => sum + value, 0) });
      expect(hands[handIndex].chipSum).toBe(0);
      if (handIndex + 1 < handCount) {
        await page.getByRole('button', { name: /next hand|次のハンド/i }).first().click();
        await expect.poll(() => page.evaluate(() =>
          window.__BADUGI_E2E__.getStateSnapshot().handId)).not.toBe(hand.handId);
      }
    }
    const rows = await page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []);
    const target = rows.filter(row => row.actorSeat === 1);
    const others = rows.filter(row => row.actorSeat !== 1);
    const report = { modelTier, seats, mode, hands, targetChipPerHand:
      hands.reduce((sum, hand) => sum + hand.targetDelta, 0) / hands.length,
      decisions: rows.length, targetDecisions: target.length, otherDecisions: others.length,
      targetStatuses: target.map(row => ({ phase: row.phase, status: row.inferenceTrace?.status,
        model: row.inferenceTrace?.usedModelId, action: row.finalAction,
        legalActions: row.legalActions, elapsedMs: row.inferenceTrace?.elapsedMs })),
      otherStatuses: others.map(row => ({ seat: row.actorSeat, phase: row.phase,
        status: row.inferenceTrace?.status, action: row.finalAction })), errors };
    await writeFile(testInfo.outputPath('d03-seat-isolation.json'), JSON.stringify(report, null, 2));
    expect(errors).toEqual([]);
    expect(target.length).toBeGreaterThan(0);
    if (seats > 2) expect(others.length).toBeGreaterThan(0);
    expect(others.every(row => row.inferenceTrace?.status !== 'used')).toBe(true);
    expect(target.every(row => row.inferenceTrace?.status === (modelTier ? 'used' : 'not-connected'))).toBe(true);
    if (modelTier) {
      expect(target.every(row => row.inferenceTrace?.usedModelId === MODEL_IDS[modelTier])).toBe(true);
      expect(target.every(row => Number.isFinite(row.inferenceTrace?.elapsedMs)
        && row.inferenceTrace.elapsedMs < 8000)).toBe(true);
      expect(target.every(row => row.phase === 'DRAW'
        ? (/^draw\([0-4]\)$/i.test(String(row.finalAction)) || String(row.finalAction).toLowerCase() === 'pat')
          && row.legalActions?.some(action => /^draw/i.test(String(action)))
        : row.legalActions?.some(action =>
          String(action).toLowerCase() === String(row.finalAction).toLowerCase()))).toBe(true);
    }
  });
}
