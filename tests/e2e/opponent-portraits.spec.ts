import { test, expect } from '@playwright/test';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';

for (const variant of ['nlh', 'deuce_to_seven_triple_draw', 'badugi']) {
  test(`${variant}: all five opponents have loaded, visible portraits`, async ({ page }, info) => {
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
    try {
      // Seat IDs are shared by desktop and mobile; their avatar CSS classes differ.
      const images = page.locator([1, 2, 3, 4, 5].map(n => `[data-testid="seat-${n}"] img`).join(','));
      await expect(images).toHaveCount(5);
      await expect.poll(() => images.evaluateAll(elements => elements.every(element => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      })), { timeout: 15000 }).toBe(true);
      for (const image of await images.all()) await expect(image).toBeVisible();
      // Capturing before image decoding finishes can hide an actual portrait regression.
      await page.screenshot({ path: info.outputPath('opponent-portraits.png') });
      await info.attach('loaded-portraits', {
        body: JSON.stringify({
          variant,
          url: page.url(),
          release: await page.locator('meta[name="mgx-release"]').getAttribute('content'),
          images: await images.evaluateAll(elements => elements.map(element => {
            const image = element as HTMLImageElement;
            return { src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight };
          })),
        }, null, 2),
        contentType: 'application/json',
      });
    } finally {
      await deleteAuthenticatedSession(page, session);
    }
  });
}
