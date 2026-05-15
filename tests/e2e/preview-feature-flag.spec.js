import { expect, test } from "@playwright/test";

test.describe("Step58 preview feature flag", () => {
  test("keeps dashboard preview hidden when flag is off", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/dev/menu");
    await expect(page.getByTestId("menu-learning-dashboard-preview")).toHaveCount(0);
  });

  test("shows dashboard preview route only when preview flag is enabled", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.preview.coaching.enabled", "true");
    });
    await page.goto("http://127.0.0.1:3000/dev/menu");
    await expect(page.getByTestId("menu-learning-dashboard-preview")).toBeVisible();
    await page.getByTestId("menu-learning-dashboard-preview").click();
    await expect(page).toHaveURL(/dev\/learning-dashboard-preview\?mgxPreview=coaching/);
    await expect(page.getByTestId("learning-dashboard-preview-screen")).toBeVisible();
    await expect(page.getByTestId("learning-dashboard-chart")).toBeVisible();
  });
});
