import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { getProgressState, invokeE2E, performSafeAction, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { installSoakSeed } from './helpers/gameplaySoakHarness';

function captureAtInference(source: string) {
  let patched = source;
  for (const [phase, actor, players, name] of [
    ['DRAW', 'seatToAct', 'snapshot', 'inferDrawDecisionWithOnnx'],
    ['BET', 'activeSeat', 'snap', 'inferBetActionWithOnnx'],
  ]) {
    const marker = new RegExp(`const inferenceResult = await runTracedOnnxInferenceWithDeadline\\(\\s*${name},\\s*\\{`);
    if ((patched.match(marker) ?? []).length !== 1) {
      throw new Error(`D03 ${phase} inference site unavailable`);
    }
    const capture = `window.__D03_RUNTIME_OBSERVATION_AUDIT__.push({
      phase: ${JSON.stringify(phase)}, seat: ${actor}, isTournament,
      handId: handIdRef.current, playerCount: ${players}.length, bb: BB,
      stack: observation.features.stack, maxStack: observation.features.maxStack,
      potFromObservation: observation.features.pot,
      settledPot: (potsRef.current ?? []).reduce((sum, pot) => sum + (Number(pot?.amount) || 0), 0),
      unsettledBets: ${players}.reduce((sum, player) => sum + (Number(player?.betThisRound) || 0), 0),
      totalInvested: ${players}.reduce((sum, player) => sum + (Number(player?.totalInvested) || 0), 0),
      publicEvents: (handHistoryRef.current?.events ?? []).map(event => ({
        type: event.type, seat: event.seat, action: event.action,
        amount: event.amount, drawCount: event.drawCount,
        from: event.from, to: event.to,
      })),
      actorCardTypes: (${players}[${actor}]?.hand ?? []).map(card => typeof card),
      players: ${players}.map(player => ({
        betHistory: Array.isArray(player?.betHistory) ? player.betHistory.length : null,
        drawHistory: Array.isArray(player?.drawHistory) ? player.drawHistory.length : null,
        openedCurrentRound: typeof player?.openedCurrentRound,
        lastDrawCount: typeof player?.lastDrawCount,
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
    expect(rows.some(row => row.publicEvents.some(event => event.type === 'BET_ACTION'))).toBe(true);
    expect(rows.some(row => row.publicEvents.some(event => event.type === 'DRAW_ACTION'))).toBe(true);
  });
}
