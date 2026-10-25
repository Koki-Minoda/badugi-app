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
    expect(bounds?.y).toBeGreaterThanOrEqual(48);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    const blindLabel = page.getByTestId("decision-panel").getByText("10/20", { exact: true });
    const blindBounds = await blindLabel.boundingBox();
    expect(blindBounds).not.toBeNull();
    const overlapsBlind = Boolean(bounds && blindBounds &&
      bounds.x < blindBounds.x + blindBounds.width &&
      bounds.x + bounds.width > blindBounds.x &&
      bounds.y < blindBounds.y + blindBounds.height &&
      bounds.y + bounds.height > blindBounds.y);
    expect(overlapsBlind).toBe(false);
    const tableMenu = page.locator(".mgx-play-header summary");
    await tableMenu.click();
    await expect(page.locator(".mgx-play-header nav")).toBeVisible();
    await tableMenu.click();
    await open.click();
    await expect(panel.getByText(/^Session:/)).toBeVisible();
    await panel.getByRole("button", { name: "Hide QA tools" }).click();
    await expect(open).toBeVisible();
  }
});
