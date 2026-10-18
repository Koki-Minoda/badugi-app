import { test, expect } from '@playwright/test';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';
import { CORE5_VARIANTS } from './helpers/core5LayoutAuditHelper';
import { playOneHandProgression } from './helpers/gameProgressHelper.js';

for (const variant of CORE5_VARIANTS) {
  test(`${variant.variant}: result pot headline agrees with payout sections`, async ({ page }, info) => {
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.variant}`);
    try {
      await playOneHandProgression(page, { maxSteps: 220, policy: 'heroStay', requireHeroButtonClick: true, requireDrawVisit: variant.expectsDraw });
      const overlay = page.getByTestId('hand-result-overlay');
      await expect(overlay).toBeVisible();
      const headline = await overlay.locator('h2').innerText();
      const parts = await page.getByTestId('hand-result-pot-amount').allTextContents();
      const amount = (text: string) => Number(text.replace(/[^0-9.-]/g, ''));
      const total = parts.reduce((sum, value) => sum + amount(value), 0);
      await info.attach('pot-display', { body: JSON.stringify({ variant: variant.variant, headline, parts, total }), contentType: 'application/json' });
      expect(amount(headline), JSON.stringify({ headline, parts })).toBe(total);
    } finally { await deleteAuthenticatedSession(page, session); }
  });
}
