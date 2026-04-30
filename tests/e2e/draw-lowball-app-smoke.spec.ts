import { expect, test, Page } from "@playwright/test";
import {
  APP_URL,
  openAuthenticatedGame,
  openAuthenticatedMenu,
} from "./authHelper";

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

async function playUntilHandResult(page: Page) {
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline) {
    if (await page.getByText("Hand Result").first().isVisible().catch(() => false)) {
      return;
    }

    const drawButton = page.getByTestId("action-draw-selected").first();
    if ((await drawButton.count()) && (await drawButton.isVisible().catch(() => false))) {
      const firstCard = page.getByTestId("player-0-card-0");
      if ((await firstCard.count()) && !(await firstCard.getAttribute("aria-pressed"))) {
        await firstCard.click().catch(() => {});
      }
      if (await drawButton.isEnabled().catch(() => false)) {
        await drawButton.click();
      }
      await page.waitForTimeout(250);
      continue;
    }

    const action = await clickFirstVisible(page, ["action-check", "action-call", "action-raise"]);
    if (action) {
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for hand result");
}

async function openVariantFromMenu(page: Page, variantName: RegExp) {
  await openAuthenticatedMenu(page);
  await page.getByTestId("menu-ring").click();
  await page.getByRole("button", { name: variantName }).click();
  await page
    .getByRole("button", { name: /Leaderboard|ランキング/i })
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
}

test.describe("draw lowball App smoke", () => {
  test.describe.configure({ timeout: 120000 });

  test("opens D01 from the menu variant picker", async ({ page }) => {
    await openVariantFromMenu(page, /2-7 triple draw/i);
    await expect(page.getByTestId("player-0-card-4")).toBeVisible({ timeout: 20000 });
  });

  for (const variantAlias of ["D01", "D02", "S01", "S02"]) {
    test(`plays ${variantAlias} from App routing through hand result and next hand`, async ({ page }) => {
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

      await playUntilHandResult(page);
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: /next hand/i }).click();
      await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId("player-0-card-4")).toBeVisible({ timeout: 20000 });
    });
  }
});
