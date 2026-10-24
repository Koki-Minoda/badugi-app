import { test, expect } from '@playwright/test';
import { VARIANT_AVAILABILITY } from '../../src/games/config/variantAvailability.js';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';
import { playOneHandProgression, waitForE2EDriver } from './helpers/gameProgressHelper.js';
for (const [id, variant] of Object.entries(VARIANT_AVAILABILITY)) {
  if (variant.availability !== 'preview_only' && !['super_holdem', 'fl_super_holdem'].includes(id)) continue;
  test(`${id}: portrait playable controls`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addInitScript(() => localStorage.setItem('mgx.previewVariants', 'true'));
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${id}&mode=cash`);
    try {
      await waitForE2EDriver(page);
      await page.setViewportSize({ width: 390, height: 844 });
      {
        await expect(page.getByTestId('mobile-play-layout')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('playing-portrait.png') });
        const result = await playOneHandProgression(page, { maxSteps: 220, policy: 'heroStay', requireHeroButtonClick: true, requireDrawVisit: !['flh', 'super_holdem', 'fl_super_holdem'].includes(id), drawCardIndexes: [0] });
        expect(result.status).toBe('PASS');
        for (const id of ['hand-result-next-hand', 'hand-result-cash-out']) {
          const button = page.getByTestId(id);
          await expect(button).toBeVisible();
          const box = await button.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y + box!.height).toBeLessThanOrEqual(844);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    } finally { await deleteAuthenticatedSession(page, session); }
  });
}
