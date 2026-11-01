import { expect, test } from '@playwright/test';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { waitForE2EDriver } from './helpers/gameProgressHelper.js';

test('S01 cash re-seats a busted CPU after ten hands', async ({ page }) => {
  test.setTimeout(120000);
  await page.route('**/api/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 9001, username: 'QA Hero', email: 'qa@mgx-e2e.test' }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('mgx_auth', JSON.stringify({
      accessToken: 'test', tokenType: 'Bearer',
      user: { id: 9001, username: 'QA Hero' }, isAuthenticated: true,
    }));
    localStorage.setItem('mgx.previewVariants', 'true');
  });
  await page.goto(APP_URL);
  await enterTitleIfPresent(page);
  await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page, 'deuce_to_seven_single_draw');
  await waitForE2EDriver(page);

  // Bust the CPU at seat 1, then advance ten hands through the real UI.
  await page.evaluate(() => window.__BADUGI_E2E__.setupCashRebuyTerminalFixtureForTest());
  await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
  const original = await page.evaluate(() => {
    const state = window.__BADUGI_E2E__.getStateSnapshot();
    return { handCount: state.handCount };
  });
  for (let offset = 1; offset <= 10; offset += 1) {
    await page.getByTestId('hand-result-next-hand').click();
    await expect.poll(() => page.evaluate(() => window.__BADUGI_E2E__.getStateSnapshot().handCount))
      .toBe(original.handCount + offset);
    const state = await page.evaluate(() => window.__BADUGI_E2E__.getStateSnapshot());
    const opponent = state.players[1];
    if (offset < 10) {
      expect(opponent.seatOut).toBe(true);
      expect(opponent.stack).toBe(0);
      await expect(page.getByTestId('seat-1')).toContainText('OUT');
      await expect(page.getByTestId('action-fold')).toBeEnabled();
      await page.getByTestId('action-fold').click();
      await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
    } else {
      expect(opponent.seatOut).toBe(false);
      expect(opponent.stack).toBeGreaterThan(0);
      expect(state.controllerSnapshot.players[1].hand).toHaveLength(5);
    }
  }

});
