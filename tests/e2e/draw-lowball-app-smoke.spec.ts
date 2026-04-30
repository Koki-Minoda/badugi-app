import { expect, test, Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

async function clickFirstVisible(page: Page, testIds: string[]) {
  for (const testId of testIds) {
    const locator = page.getByTestId(testId).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) {
      await locator.click();
      return testId;
    }
  }
  return null;
}

async function waitForDrawAction(page: Page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const drawButton = page.getByTestId("action-draw-selected").first();
    if ((await drawButton.count()) && (await drawButton.isVisible().catch(() => false))) {
      return drawButton;
    }
    await clickFirstVisible(page, ["action-check", "action-call", "action-raise"]);
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for draw action");
}

test.describe("draw lowball App smoke", () => {
  test.describe.configure({ timeout: 90000 });

  for (const variantAlias of ["D01", "D02"]) {
    test(`opens ${variantAlias} through App routing and reaches draw controls`, async ({ page }) => {
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          browserErrors.push(message.text());
        }
      });
      try {
        await openAuthenticatedGame(page, `${APP_URL}?variant=${variantAlias}`);
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\nBrowser errors:\n${browserErrors.join("\n")}`,
        );
      }
      expect(browserErrors).toEqual([]);

      await expect(page.getByTestId("player-0-card-4")).toBeVisible({ timeout: 20000 });

      const drawButton = await waitForDrawAction(page);
      await page.getByTestId("player-0-card-0").click();
      await expect(page.getByTestId("player-0-card-0")).toHaveAttribute(
        "aria-pressed",
        "true",
        { timeout: 5000 },
      );
      await drawButton.click();
      await expect(page.getByTestId("player-0-card-0")).not.toHaveAttribute(
        "aria-pressed",
        "true",
        { timeout: 10000 },
      );
    });
  }
});
