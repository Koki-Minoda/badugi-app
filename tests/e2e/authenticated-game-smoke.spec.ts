import { test, expect, Page } from "@playwright/test";
import {
  APP_URL,
  dismissTranslateOverlay,
  enterTitleIfPresent,
  uniqueE2eEmail,
} from "./authHelper";

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return (
        api &&
        typeof api === "object" &&
        typeof api.getPhaseState === "function"
      );
    },
    null,
    { timeout: 30000 },
  );
}

async function clickFirstVisible(page: Page, testIds: string[], timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const testId of testIds) {
      const locator = page.getByTestId(testId).first();
      if (await locator.isVisible().catch(() => false)) {
        await locator.click();
        return testId;
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for one of: ${testIds.join(", ")}`);
}

async function waitForDrawPhase(page: Page, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const drawButton = page.getByTestId("action-draw-selected").first();
    if (await drawButton.isVisible().catch(() => false)) {
      return drawButton;
    }
    const action = await clickFirstVisible(
      page,
      ["action-check", "action-call", "action-raise"],
      2000,
    ).catch(() => null);
    if (action) {
      await page.waitForTimeout(350);
      continue;
    }
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for draw phase");
}

test.describe("authenticated player smoke", () => {
  test.describe.configure({ timeout: 90000 });

  test("signs up, logs in, opens ring, bets, and draws a selected card", async ({ page }) => {
    const email = uniqueE2eEmail("mgx.playwright");
    const password = "MgxE2E!2026";

    await page.goto(APP_URL, { waitUntil: "load" });
    await dismissTranslateOverlay(page);
    await enterTitleIfPresent(page);

    await page.getByTestId("auth-signup-tab").click();
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-confirm-password").fill(password);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByText(/Signup successful/i)).toBeVisible({ timeout: 15000 });
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();

    await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("menu-ring").click();
    await page
      .getByRole("button", { name: /Leaderboard/i })
      .first()
      .waitFor({ state: "visible", timeout: 20000 });

    await waitForE2EDriver(page);
    const bettingAction = await clickFirstVisible(page, [
      "action-raise",
      "action-call",
      "action-check",
    ]);
    expect(["action-raise", "action-call", "action-check"]).toContain(bettingAction);

    const drawButton = await waitForDrawPhase(page);
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
});
