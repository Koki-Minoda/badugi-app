import { expect, test } from "@playwright/test";
import { APP_URL, deleteAuthenticatedSession, openAuthenticatedGame } from "./authHelper";

for (const variant of ["nlh", "plo", "five_card_plo", "dramaha_hi", "D01", "D02", "D04", "D06", "S01", "S02", "S03", "S04", "badugi"]) {
  test(`${variant} keeps six seat boxes separate on desktop tables`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}&mode=cash&mgxQa=mobile`);
    try {
      for (const viewport of [
        { width: 1024, height: 768 },
        { width: 1280, height: 720 },
        { width: 1440, height: 900 },
        { width: 1920, height: 1080 },
      ]) {
        await page.setViewportSize(viewport);
        const seats = await Promise.all(
          Array.from({ length: 6 }, (_, index) => page.getByTestId(`seat-${index}`).boundingBox()),
        );
        expect(seats.every(Boolean)).toBe(true);
        const overlaps: string[] = [];
        for (let left = 0; left < seats.length; left += 1) {
          for (let right = left + 1; right < seats.length; right += 1) {
            const a = seats[left]!;
            const b = seats[right]!;
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX > 2 && overlapY > 2) {
              overlaps.push(`${left}-${right}: ${Math.round(overlapX)}×${Math.round(overlapY)}px`);
            }
          }
        }
        expect(overlaps, `${viewport.width}×${viewport.height}: ${JSON.stringify(seats)}`).toEqual([]);
        if (variant === "nlh" || variant === "five_card_plo") {
          await page.screenshot({ path: testInfo.outputPath(`${variant}-${viewport.width}x${viewport.height}.png`) });
        } else if (variant === "D04") {
          await page.screenshot({ path: testInfo.outputPath(`badeucey-${viewport.width}x${viewport.height}.png`) });
        } else if (variant === "D01") {
          await page.screenshot({ path: testInfo.outputPath(`two-seven-draw-${viewport.width}x${viewport.height}.png`) });
        }
      }
    } finally {
      await deleteAuthenticatedSession(page, session);
    }
  });
}
