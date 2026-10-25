import { expect, test } from "@playwright/test";
import { APP_URL, deleteAuthenticatedSession, openAuthenticatedGame } from "./authHelper";

test("entering a table keeps the seat HUD closed until the pointer moves over a seat", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const session = await openAuthenticatedGame(page, `${APP_URL}?variant=D06&mode=cash&mgxQa=mobile`);
  try {
    await expect(page.getByTestId("decision-panel")).toBeVisible();
    await expect(page.locator('[data-testid^="seat-"][data-testid$="-detail"]')).toHaveCount(0);

    const seat = page.getByTestId("seat-4");
    await seat.dispatchEvent("mouseover");
    await expect(page.locator('[data-testid^="seat-"][data-testid$="-detail"]')).toHaveCount(0);
    const box = await seat.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.getByTestId("seat-4-detail")).toBeVisible();
  } finally {
    await deleteAuthenticatedSession(page, session);
  }
});
