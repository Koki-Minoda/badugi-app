import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { installSoakSeed } from './helpers/gameplaySoakHarness';

function captureAtInference(source: string) {
  let patched = `import { buildBadugiLiveTrainingObservationDiagnostic } from '../rl/badugiLiveTrainingObservationDiagnostic.js';\n${source}`;
  for (const [phase, actor, players, name] of [
    ['DRAW', 'seatToAct', 'snapshot', 'inferDrawDecisionWithOnnx'],
    ['BET', 'activeSeat', 'snap', 'inferBetActionWithOnnx'],
  ]) {
    const marker = new RegExp(`const inferenceResult = await runTracedOnnxInferenceWithDeadline\\(\\s*${name},\\s*\\{`);
    if ((patched.match(marker) ?? []).length !== 1) {
      throw new Error(`D03 ${phase} inference site unavailable`);
    }
    const capture = `window.__D03_RUNTIME_OBSERVATION_AUDIT__.push({
      phase: ${JSON.stringify(phase)}, seat: ${actor}, isTournament, drawRound,
      handId: handIdRef.current, playerCount: ${players}.length, bb: BB,
      stack: observation.features.stack, maxStack: observation.features.maxStack,
      potFromObservation: observation.features.pot,
      settledPot: (potsRef.current ?? []).reduce((sum, pot) => sum + (Number(pot?.amount) || 0), 0),
      unsettledBets: ${players}.reduce((sum, player) => sum + (Number(player?.betThisRound) || 0), 0),
      totalInvested: ${players}.reduce((sum, player) => sum + (Number(player?.totalInvested) || 0), 0),
      totalStacks: ${players}.reduce((sum, player) => sum + (Number(player?.stack) || 0), 0),
      publicEvents: (handHistoryRef.current?.events ?? []).map(event => ({
        type: event.type, seat: event.seat, action: event.action,
        drawRoundIndex: event.drawRoundIndex, betRoundIndex: event.betRoundIndex,
        amount: event.amount, drawCount: event.drawCount,
        sbSeat: event.sbSeat, bbSeat: event.bbSeat,
        sbAmount: event.sbAmount, bbAmount: event.bbAmount,
        from: event.from, to: event.to,
      })),
      actorDrawCountFromEvents: (handHistoryRef.current?.events ?? [])
        .filter(event => event.type === 'DRAW_ACTION' && event.seat === ${actor})
        .reduce((sum, event) => sum + (Number(event.drawCount) || 0), 0),
      actorDiscardCountFromEvents: (handHistoryRef.current?.events ?? [])
        .filter(event => event.type === 'DRAW_ACTION' && event.seat === ${actor})
        .reduce((sum, event) => sum + (Array.isArray(event.replacedCards) ? event.replacedCards.length : 0), 0),
      actorDiscardCardShapes: (handHistoryRef.current?.events ?? [])
        .filter(event => event.type === 'DRAW_ACTION' && event.seat === ${actor})
        .flatMap(event => Array.isArray(event.replacedCards) ? event.replacedCards : [])
        .map(entry => typeof entry.oldCard === 'string' && /^(?:[2-9]|10|[AJQK])[CDHS]$/.test(entry.oldCard)),
      trainingDiagnostic: (() => {
        try {
          const vector = buildBadugiLiveTrainingObservationDiagnostic({
            players: ${players}, events: handHistoryRef.current?.events ?? [],
            seatIndex: ${actor}, phase: ${JSON.stringify(phase)}, drawRoundIndex: drawRound,
            dealerIndex: dealerIdx, bigBlind: BB, raiseCount: raiseCountThisRound,
            currentBet: maxBetThisRound(${players}),
            legalActions: ${phase === 'DRAW' ? 'drawLegalActions' : 'onnxLegalActions'},
          });
          return { ready: true, vectorLength: vector.length,
            maskCount: vector.slice(32, 38).filter(value => value === 1).length,
            potSlot: vector[11] };
        } catch (error) {
          return { ready: false, error: String(error?.message ?? error) };
        }
      })(),
      actorCardTypes: (${players}[${actor}]?.hand ?? []).map(card => typeof card),
      players: ${players}.map(player => ({
        stack: player?.stack, betThisRound: player?.betThisRound,
        totalInvested: player?.totalInvested,
        folded: Boolean(player?.folded ?? player?.hasFolded),
        betHistory: Array.isArray(player?.betHistory) ? player.betHistory.length : null,
        drawHistory: Array.isArray(player?.drawHistory) ? player.drawHistory.length : null,
        openedCurrentRound: typeof player?.openedCurrentRound,
        lastDrawCount: Number.isInteger(player?.lastDrawCount) ? player.lastDrawCount : null,
        discardedCards: Array.isArray(player?.discardedCards) ? player.discardedCards.length : null,
      })),
    });
    `;
    patched = patched.replace(marker, match => capture + match);
  }
  return patched;
}

for (const mode of ['cash', 'tournament'] as const) {
  test(`D03 ${mode} runtime observation availability`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installSoakSeed(page, mode === 'cash' ? 20261501 : 20261502);
    await page.route('**/src/ui/App.jsx*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: captureAtInference(await response.text()) });
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
      window.__D03_RUNTIME_OBSERVATION_AUDIT__ = [];
    });
    await page.goto(`${APP_URL}?variant=D03&mode=cash&mgxQa=mobile`);
    await enterTitleIfPresent(page);
    await page.getByTestId('menu-ring').click();
    await selectGameVariantFromSelector(page, 'badugi');
    await waitForE2EDriver(page);
    if (mode === 'tournament') {
      await invokeE2E(page, 'startTournamentMTT', {
        id: 'd03-observation-availability', name: 'D03 Observation Availability',
        tables: 1, seatsPerTable: 6, totalPlayers: 6, startingStack: 2000,
        gameVariant: 'badugi', gameRotation: ['badugi'], rotationPolicy: 'fixed',
        levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
      await expect(page.getByTestId('tournament-hud')).toBeVisible();
    }
    for (let step = 0; step < 120; step += 1) {
      const progress = await getProgressState(page);
      if (progress.isTerminal) break;
      const action = await performSafeAction(page, { autoCpu: true, policy: 'heroStay' });
      expect(action.acted, JSON.stringify(action)).toBe(true);
    }
    await expect.poll(async () => {
      if (await page.getByTestId('hand-result-overlay').isVisible().catch(() => false)) return true;
      if (mode === 'tournament') {
        const hud = await page.evaluate(() => window.__BADUGI_E2E__.getTournamentHudState());
        return Boolean(hud?.isFinished || hud?.heroBusted);
      }
      return false;
    }, { timeout: 10000 }).toBe(true);
    const rows = await page.evaluate(() => window.__D03_RUNTIME_OBSERVATION_AUDIT__ ?? []);
    await writeFile(testInfo.outputPath('d03-runtime-observation-availability.json'),
      JSON.stringify({ mode, seed: mode === 'cash' ? 20261501 : 20261502, rows, errors }, null, 2));
    expect(errors).toEqual([]);
    expect(rows.some(row => row.phase === 'BET')).toBe(true);
    expect(rows.some(row => row.phase === 'DRAW')).toBe(true);
    expect(rows.every(row => row.playerCount === 6 && row.bb > 0 && row.stack >= 0)).toBe(true);
    expect(rows.every(row => row.totalInvested > 0 && row.publicEvents.length > 0)).toBe(true);
    expect(rows.every(row => row.totalStacks + row.totalInvested ===
      (mode === 'cash' ? 3000 : 12000))).toBe(true);
    expect(rows.some(row => row.publicEvents.some(event => event.type === 'BET_ACTION'))).toBe(true);
    expect(rows.some(row => row.publicEvents.some(event => event.type === 'DRAW_ACTION'))).toBe(true);
    expect(rows.every(row => row.actorDiscardCountFromEvents === row.actorDrawCountFromEvents)).toBe(true);
    expect(rows.every(row => row.actorDiscardCardShapes.every(Boolean))).toBe(true);
    expect(rows.some(row => row.actorDiscardCountFromEvents > 0)).toBe(true);
    expect(rows.every(row => row.trainingDiagnostic.ready &&
      row.trainingDiagnostic.vectorLength === 96 && row.trainingDiagnostic.maskCount > 0)).toBe(true);
  });
}
