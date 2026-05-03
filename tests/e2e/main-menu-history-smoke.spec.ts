import { expect, test } from "@playwright/test";
import { APP_URL, gotoWithRetry } from "./authHelper";

test.describe("main menu history navigation", () => {
  test("opens hand history from the standalone menu route", async ({ page }) => {
    await gotoWithRetry(page, `${APP_URL}dev/menu`);

    await page.getByTestId("menu-history").click();

    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("heading", { name: /トーナメント & ハンド履歴/i })).toBeVisible();
  });
});
