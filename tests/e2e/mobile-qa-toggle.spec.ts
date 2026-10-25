import { expect, test } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

test("the mobile QA control stays compact until opened and remains touchable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=cash&mgxQa=mobile`);

  const panel = page.getByTestId("mobile-qa-debug-panel");
  for (const viewport of [{ width: 390, height: 844 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport);
    const open = panel.getByRole("button", { name: "Open QA tools" });
    await expect(open).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds?.width).toBeLessThanOrEqual(48);
    expect(bounds?.height).toBeLessThanOrEqual(48);
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    await open.click();
    await expect(panel.getByText(/^Session:/)).toBeVisible();
    await panel.getByRole("button", { name: "Hide QA tools" }).click();
    await expect(open).toBeVisible();
  }
});
