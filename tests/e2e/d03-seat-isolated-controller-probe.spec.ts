import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { installSoakSeed } from './helpers/gameplaySoakHarness';

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

type SessionCase = { sessionId?: string; modelTier: null | keyof typeof MODEL_IDS;
  seats: number; mode: 'cash' | 'tournament'; handCount: number;
  seed?: number; heroPolicy?: 'heroStay' | 'heroAggressive' };

const DEFAULT_CASES: SessionCase[] = [
  ...([null, ...Object.keys(MODEL_IDS)] as Array<null | keyof typeof MODEL_IDS>)
    .map(modelTier => ({ modelTier, seats: 6, mode: 'cash' as const, handCount: 2 })),
  { modelTier: 'standard', seats: 2, mode: 'cash', handCount: 2 },
  { modelTier: 'standard', seats: 3, mode: 'cash', handCount: 2 },
  { modelTier: 'standard', seats: 6, mode: 'tournament', handCount: 1 },
];
const manifestPath = process.env.D03_SESSION_MANIFEST;
const manifestSource = manifestPath ? readFileSync(manifestPath, 'utf8') : null;
const manifest = manifestSource ? JSON.parse(manifestSource) : null;
const manifestSha256 = manifestSource
  ? createHash('sha256').update(manifestSource).digest('hex') : null;
if (manifest) {
  if (manifest.purpose !== 'pilot-only' || !Array.isArray(manifest.sessions)
    || manifest.sessions.length === 0) throw new Error('Invalid D03 pilot manifest');
  const ids = new Set<string>();
  for (const session of manifest.sessions as SessionCase[]) {
    if (!session.sessionId || ids.has(session.sessionId)
      || (session.modelTier !== null && !(session.modelTier in MODEL_IDS))
      || ![2, 3, 6].includes(session.seats)
      || !['cash', 'tournament'].includes(session.mode)
      || !Number.isInteger(session.handCount) || session.handCount < 1
      || !Number.isInteger(session.seed) || session.seed < 1
      || !['heroStay', 'heroAggressive'].includes(session.heroPolicy ?? 'heroStay')) {
      throw new Error(`Invalid D03 pilot session: ${session.sessionId ?? '<missing id>'}`);
    }
    ids.add(session.sessionId);
  }
}
const CASES: SessionCase[] = manifest ? manifest.sessions : DEFAULT_CASES;

for (const { sessionId, modelTier, seats, mode, handCount, seed, heroPolicy = 'heroStay' } of CASES) {
  test(`D03 ${sessionId ?? `${modelTier ?? 'teacher'} seat-one isolation over ${handCount} ${mode} hands at ${seats} seats`}`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const sessionSeed = seed ?? Number(process.env.D03_PROBE_SEED);
    if (Number.isInteger(sessionSeed) && sessionSeed > 0) await installSoakSeed(page, sessionSeed);
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
        tables: 1, seatsPerTable: seats, totalPlayers: seats, startingStack: 2000,
        gameVariant: 'badugi', gameRotation: ['badugi'], rotationPolicy: 'fixed',
        levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
      await expect(page.getByTestId('tournament-hud')).toBeVisible();
    }
    const hands: Array<{ handId: unknown; initialHandDigest: string; targetDelta: number; chipSum: number;
      actionEvents: unknown[];
      seats: Array<{ seat: number; startStack: number; finalStack: number; delta: number }> }> = [];
    for (let handIndex = 0; handIndex < handCount; handIndex += 1) {
      for (let step = 0; step < 120; step += 1) {
        const progress = await getProgressState(page);
        if (progress.isTerminal) break;
        const action = await performSafeAction(page, { autoCpu: true, policy: heroPolicy });
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
      const initialHandDigest = createHash('sha256').update(JSON.stringify(
        hand.seats.map(seat => ({ seat: seat.seat, initialHand: seat.initialHand })))).digest('hex');
      hands.push({ handId: hand.handId, initialHandDigest, targetDelta: deltas[1],
        chipSum: deltas.reduce((sum, value) => sum + value, 0),
        actionEvents: hand.events
          .filter(event => /BET|DRAW|ACTION/i.test(String(event.type)))
          .map(event => ({ type: event.type, actionSeq: event.actionSeq,
            seat: event.seat, action: event.action ?? null,
            amount: event.amount ?? null, betBefore: event.betBefore ?? null,
            betAfter: event.betAfter ?? null, stackBefore: event.stackBefore ?? null,
            stackAfter: event.stackAfter ?? null, potAfter: event.potAfter ?? null,
            drawCount: event.drawCount ?? null })),
        seats: hand.seats.map((seat, index) => ({ seat: seat.seat,
          startStack: Number(seat.startStack),
          finalStack: Number(finalStacks.find(entry => entry.seat === seat.seat)?.stack),
          delta: deltas[index] })) });
      expect(hands[handIndex].chipSum).toBe(0);
      if (handIndex + 1 < handCount) {
        await page.getByRole('button', { name: /next hand|次のハンド/i }).first().click();
        await expect.poll(() => page.evaluate(() =>
          window.__BADUGI_E2E__.getStateSnapshot().handId)).not.toBe(hand.handId);
      }
    }
    const rows = await page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []);
    const decisionRows = rows.filter(row => row.phase === 'BET' || row.phase === 'DRAW');
    const nonDecisionRows = rows.filter(row => row.phase !== 'BET' && row.phase !== 'DRAW');
    const target = decisionRows.filter(row => row.actorSeat === 1);
    const others = decisionRows.filter(row => row.actorSeat !== 1);
    const report = { purpose: 'controller-instrumentation-only',
      sessionDesign: manifest?.purpose ?? 'default-functional-probe',
      manifestSha256, sessionId: sessionId ?? null, modelTier, seats, mode,
      plannedHandCount: handCount,
      opponentStructure: { seatZero: heroPolicy, otherCpuSeats: 'teacher' },
      sessionSeed: Number.isInteger(sessionSeed) && sessionSeed > 0 ? sessionSeed : null,
      hands, targetChipPerHand:
      hands.reduce((sum, hand) => sum + hand.targetDelta, 0) / hands.length,
      traceRows: rows.length, decisions: decisionRows.length,
      nonDecisionRows: nonDecisionRows.length,
      targetDecisions: target.length, otherDecisions: others.length,
      targetStatuses: target.map(row => ({ phase: row.phase, status: row.inferenceTrace?.status,
        model: row.inferenceTrace?.usedModelId, action: row.finalAction,
        legalActions: row.legalActions, elapsedMs: row.inferenceTrace?.elapsedMs,
        fallbackReason: row.fallbackReason ?? row.inferenceTrace?.reason ?? null })),
      otherStatuses: others.map(row => ({ seat: row.actorSeat, phase: row.phase,
        status: row.inferenceTrace?.status, action: row.finalAction,
        fallbackReason: row.fallbackReason ?? row.inferenceTrace?.reason ?? null })),
      decisionTrace: rows, errors };
    await writeFile(testInfo.outputPath('d03-seat-isolation.json'), JSON.stringify(report, null, 2));
    expect(errors).toEqual([]);
    expect(nonDecisionRows.every(row => row.phase === 'SHOWDOWN'
      && /^collect /i.test(String(row.finalAction)) && row.legalActions?.length === 0)).toBe(true);
    expect(target.length).toBeGreaterThan(0);
    if (seats > 2) expect(others.length).toBeGreaterThan(0);
    expect(decisionRows.every(row => Boolean(row.inferenceTrace?.status))).toBe(true);
    expect(decisionRows.some(row => String(row.fallbackReason ?? '').includes('FL_RAISE_CAP'))).toBe(false);
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
