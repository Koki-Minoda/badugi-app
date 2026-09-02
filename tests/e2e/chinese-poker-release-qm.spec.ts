import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

const HISTORY_KEY = "mgx.chinesePokerHistory.v1";
const HANDS = 10;

async function assertNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
}

async function assertButtonCanBePressed(page: Page, testId: string) {
  const button = page.getByTestId(testId);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click({ trial: true });
}

async function assertCompletedHistory(page: Page, minimumHands: number) {
  const audit = await page.evaluate(({ key, minimum }) => {
    const histories = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    const latest = histories[0] ?? null;
    const totals = Object.values(latest?.results?.totals ?? {}).map(Number);
    return {
      count: histories.length,
      uniqueHandIds: new Set(histories.map((entry: any) => entry?.handId)).size,
      variantId: latest?.variantId,
      eventTypes: (latest?.events ?? []).map((event: any) => event?.type),
      initialCardCount: (latest?.seats ?? []).flatMap((seat: any) => seat?.initialHand ?? []).length,
      uniqueInitialCards: new Set(
        (latest?.seats ?? []).flatMap((seat: any) => seat?.initialHand ?? []),
      ).size,
      zeroSum: totals.length >= 2 && totals.reduce((sum, value) => sum + value, 0) === 0,
      minimum,
    };
  }, { key: HISTORY_KEY, minimum: minimumHands });

  expect(audit.count).toBeGreaterThanOrEqual(minimumHands);
  expect(audit.uniqueHandIds).toBeGreaterThanOrEqual(minimumHands);
  expect(audit.variantId).toBe("chinese_poker");
  expect(audit.eventTypes).toEqual(["HAND_START", "ROWS_SET", "SHOWDOWN"]);
  expect(audit.initialCardCount).toBe(26);
  expect(audit.uniqueInitialCards).toBe(26);
  expect(audit.zeroSum).toBe(true);
}

test.describe("Classic Chinese Poker release QM", () => {
  test.describe.configure({ timeout: 240_000 });

  test("completes 10 real-button hands with exact replay and mobile-safe layout", async ({ page }, testInfo) => {
    const fatalErrors: string[] = [];
    page.on("pageerror", (error) => fatalErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) fatalErrors.push(`${response.status()} ${response.url()}`);
    });

    await openAuthenticatedGame(page, `${APP_URL}?variant=chinese_poker&mode=cash`);
    await expect(page.getByTestId("chinese-poker-screen")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Chinese Poker" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    for (let hand = 1; hand <= HANDS; hand += 1) {
      await expect(page.getByText(new RegExp(`(?:Hand|ハンド) #${hand}`, "i")).first())
        .toBeVisible({ timeout: 20_000 });

      const heroCards = page.getByTestId("chinese-hero-arrange").locator("[data-testid^='chinese-card-']");
      await expect(heroCards).toHaveCount(13);
      const cardIds = await heroCards.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-testid")),
      );
      expect(new Set(cardIds).size).toBe(13);

      const autoArrange = page.getByRole("button", { name: /Auto Arrange|自動配置/i });
      await autoArrange.scrollIntoViewIfNeeded();
      await autoArrange.click();
      await assertButtonCanBePressed(page, "chinese-submit");
      await page.getByTestId("chinese-submit").click();

      await expect(page.getByTestId("chinese-results")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("chinese-replay-integrity"))
        .toContainText(/verified|再現済み/i);
      await expect(page.getByTestId("chinese-history-replay")).toContainText(/ROWS_SET/);
      await assertNoHorizontalOverflow(page);
      await assertCompletedHistory(page, hand);

      if (hand < HANDS) {
        await assertButtonCanBePressed(page, "chinese-next-hand");
        await page.getByTestId("chinese-next-hand").click();
      }
    }

    expect(fatalErrors).toEqual([]);

    const device = testInfo.project.name.includes("android")
      ? "android"
      : testInfo.project.name.includes("iphone")
        ? "iphone"
        : "desktop";
    const reportDir = path.resolve("reports/all-live-cash");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, `chinese_poker-${device}-${HANDS}-hands.json`),
      `${JSON.stringify({
        schemaVersion: 1,
        status: "PASS",
        target: APP_URL,
        variant: "chinese_poker",
        mode: "classic-13-card",
        explicitlyExcludes: ["ofc", "fantasyland", "street-placement"],
        device,
        handsCompleted: HANDS,
        historyRecords: HANDS,
        exactReplayVerified: HANDS,
        zeroSumPointsVerified: HANDS,
        horizontalOverflowIssues: 0,
        fatalErrors,
      }, null, 2)}\n`,
    );
  });
});
