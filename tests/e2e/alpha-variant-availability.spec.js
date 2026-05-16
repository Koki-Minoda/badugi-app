import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedMenu } from "./authHelper";

async function openGameSelector(page) {
  await openAuthenticatedMenu(page);
  await page.getByTestId("menu-ring").click();
  await expect(page.getByText(/Select Your Variant|ゲームを選択/i)).toBeVisible({ timeout: 20000 });
}

test.describe("alpha variant availability gate", () => {
  test("alpha mode exposes only alpha-playable launch buttons by default", async ({ page }) => {
    await openGameSelector(page);

    await expect(page.getByTestId("game-selector-play-ace_to_five_triple_draw")).toBeEnabled();
    await expect(page.getByTestId("game-selector-play-badugi")).toBeDisabled();
    await expect(page.getByTestId("game-selector-card-badugi")).toContainText(/Preview|検証中/);

    await page.getByRole("button", { name: /Single Draw|シングルドロー/i }).click();
    await expect(page.getByTestId("game-selector-play-deuce_to_seven_single_draw")).toBeEnabled();
    await expect(page.getByTestId("game-selector-play-ace_to_five_single_draw")).toBeEnabled();
  });

  test("coming-soon variants stay disabled", async ({ page }) => {
    await openGameSelector(page);
    await page.getByRole("button", { name: /Chinese|OFC|チャイニーズ/i }).click();

    await expect(page.getByTestId("game-selector-play-chinese_poker")).toBeDisabled();
    await expect(page.getByTestId("game-selector-card-chinese_poker")).toContainText(/Coming Soon|準備中/);
  });

  test("preview-only variants can be launched only with explicit preview flag", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.previewVariants", "true");
    });
    await openGameSelector(page);

    await expect(page.getByTestId("game-selector-play-badugi")).toBeEnabled();
  });

  test("mobile viewport keeps status labels visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGameSelector(page);

    await expect(page.getByTestId("game-selector-card-badugi")).toContainText(/Preview|検証中/);
    await expect(page.getByTestId("game-selector-play-badugi")).toBeDisabled();
  });
});
