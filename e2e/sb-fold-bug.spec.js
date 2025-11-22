import { test, expect } from "@playwright/test";

test("debug start screen", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.screenshot({ path: "tests/start-screen.png" });
  await page.pause();
});

test("SB folding before flop does not stall the hand", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("http://localhost:3000/");
  const translateBubble = page.locator("text=Google Translate");
  if (await translateBubble.count()) {
    await translateBubble.click().catch(() => {});
  }
  const closeButtons = page.locator("button:has-text(\"閉じる\")");
  if (await closeButtons.count()) {
    await closeButtons.first().click().catch(() => {});
  }
  const startButton = page.getByText("START", { exact: true });
  await startButton.waitFor({ state: "visible", timeout: 15000 });
  await expect(startButton).toBeVisible();

  await page.evaluate(() => {
    window.__BADUGI_E2E__?.setDealerIndex?.(5);
  });

  await startButton.click();
  const reachedGame = await Promise.race([
    page.waitForURL("**/game*", { timeout: 10000 }).then(() => "game"),
    page.waitForURL("**/menu*", { timeout: 10000 }).then(() => "menu"),
  ]);
  if (reachedGame === "menu") {
    await page.goto("http://localhost:3000/game", { waitUntil: "load" });
  }
  const leaderboardButton = page.getByRole("button", { name: /Leaderboard/i }).first();
  if (!(await leaderboardButton.count())) {
    await page.getByText("Leaderboard").first().waitFor({ state: "visible", timeout: 8000 });
  } else {
    await leaderboardButton.waitFor({ state: "visible", timeout: 8000 });
  }

  const sbSeat = page.getByTestId("seat-sb").nth(1);
  await expect(sbSeat).toBeVisible({ timeout: 5000 });

  const foldButton = page.getByRole("button", { name: /fold/i });
  await expect(foldButton).toBeVisible({ timeout: 5000 });
  await foldButton.click();

  // The next action may belong to another player, so we only ensure the UI is still responsive.
  await page.waitForTimeout(1000);
  const phaseCell = page.getByText(/Phase:/).first();
  await expect(phaseCell).toContainText(/DRAW#/);

  await expect(consoleErrors).toEqual([]);
  await expect(pageErrors).toEqual([]);

  await page.screenshot({ path: "tests/sb-fold-bug.png" });
});
