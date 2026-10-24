import { test, expect } from '@playwright/test';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';
import { getProgressState, waitForE2EDriver } from './helpers/gameProgressHelper.js';
for (const variant of ['flh', 'fl_super_holdem', 'flo8']) {
  test(`${variant}: opening bet advances the hand from the visible button`, async ({page}) => {
    test.setTimeout(90000);
    await page.addInitScript(() => localStorage.setItem('mgx.previewVariants','true'));
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}&mode=cash`);
    try {
      await waitForE2EDriver(page);
      let tested = false;
      for (let step=0; step<300; step++) {
        const state = await getProgressState(page);
        if (state.ui.resultVisible) { await page.getByTestId('hand-result-next-hand').click(); continue; }
        if (state.actor === 0) {
          if (['FLOP','TURN','RIVER'].includes(state.snapshot?.street) && state.currentBet === 0) {
            const invested = state.players[0].totalInvested;
            await page.getByTestId('action-raise').click();
            await expect.poll(async () => (await getProgressState(page)).players[0].totalInvested, { timeout: 4000 }).toBeGreaterThan(invested);
            tested = true; break;
          }
          for (const id of ['action-check','action-call']) {
            const button = page.getByTestId(id).first();
            if (await button.isVisible() && await button.isEnabled()) { await button.click(); break; }
          }
        }
        await page.waitForTimeout(100);
      }
      expect(tested, 'must reach and test an unopened postflop street').toBe(true);
    } finally { await deleteAuthenticatedSession(page, session); }
  });
}
