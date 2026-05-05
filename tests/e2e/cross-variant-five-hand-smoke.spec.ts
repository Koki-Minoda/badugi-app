import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.resolveHandNow === "function" &&
          typeof api.dealNewHandNow === "function" &&
          typeof api.forceDealNewHandNow === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function expectHeroCards(page: Page, count: number) {
  for (let idx = 0; idx < count; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function expectActionPanelStable(page: Page) {
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
}

async function expectChineseHeroCards(page: Page) {
  await expect
    .poll(async () => page.locator("[data-testid^='chinese-card-']").count(), { timeout: 20000 })
    .toBeGreaterThanOrEqual(13);
}

test.describe("cross variant five-hand UI smoke", () => {
  test.describe.configure({ timeout: 180000 });

  [
    { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i, heroCards: 2 },
    { variant: "flh", title: /Fixed-Limit Hold'em|FL Hold'em/i, heroCards: 2 },
    { variant: "super_holdem", title: /Super Hold'em/i, heroCards: 3, forceInitialHand: true },
    { variant: "fl_super_holdem", title: /FL Super Hold'em/i, heroCards: 3, forceInitialHand: true },
    { variant: "plo", title: /Pot-Limit Omaha|PLO/i, heroCards: 4 },
    { variant: "plo8", title: /PLO8|Omaha Hi-Lo/i, heroCards: 4 },
    { variant: "big_o", title: /Big-O|5-Card Omaha Hi-Lo/i, heroCards: 5 },
    { variant: "five_card_plo", title: /5-Card PLO|Five-Card PLO/i, heroCards: 5 },
    { variant: "flo8", title: /FLO8|Fixed-Limit Omaha/i, heroCards: 4 },
    { variant: "D01", title: /2-7 Triple Draw/i, heroCards: 5 },
    { variant: "D02", title: /A-5 Triple Draw/i, heroCards: 5 },
    { variant: "badugi", title: /Badugi/i, heroCards: 4 },
    { variant: "D04", title: /Badeucey TD/i, heroCards: 5 },
    { variant: "D05", title: /Badacey TD/i, heroCards: 5 },
    { variant: "D06", title: /Hidugi TD/i, heroCards: 4 },
    { variant: "D07", title: /Archie TD/i, heroCards: 5 },
    { variant: "S01", title: /2-7 Single Draw/i, heroCards: 5 },
    { variant: "S02", title: /A-5 Single Draw/i, heroCards: 5 },
    { variant: "S03", title: /5-Card Single Draw/i, heroCards: 5 },
    { variant: "S04", title: /Badugi SD|Badugi Single Draw/i, heroCards: 4 },
    { variant: "S05", title: /Badeucey Single Draw/i, heroCards: 5 },
    { variant: "S06", title: /Badacey Single Draw/i, heroCards: 5 },
    { variant: "S07", title: /Hidugi Single Draw/i, heroCards: 4 },
    { variant: "dramaha_hi", title: /Dramaha Hi/i, heroCards: 5 },
    { variant: "dramaha_27", title: /Dramaha 2-7/i, heroCards: 5 },
    { variant: "dramaha_a5", title: /Dramaha A-5/i, heroCards: 5 },
    { variant: "dramaha_zero", title: /Dramaha Zero/i, heroCards: 5 },
    { variant: "dramaha_hidugi", title: /Dramaha Hidugi/i, heroCards: 5 },
    { variant: "dramaha_badugi", title: /Dramaha Badugi/i, heroCards: 5 },
    { variant: "stud", title: /^Stud$/i, heroCards: 3 },
    { variant: "stud8", title: /Stud 8/i, heroCards: 3 },
    { variant: "razz", title: /Razz/i, heroCards: 3 },
    { variant: "razz27", title: /2-7 Razz/i, heroCards: 3 },
    { variant: "razzdugi", title: /Razzdugi/i, heroCards: 3 },
    { variant: "razzducey", title: /Razzducey/i, heroCards: 3 },
  ].forEach(({ variant, title, heroCards, forceInitialHand }) => {
    test(`${variant} can render five consecutive UI hands`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      if (forceInitialHand) {
        await invokeE2E(page, "forceDealNewHandNow");
        await page.waitForTimeout(250);
      }
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });

      for (let hand = 0; hand < 5; hand += 1) {
        await expectHeroCards(page, heroCards);
        await expectActionPanelStable(page);
        if (hand < 4) {
          await invokeE2E(page, "forceDealNewHandNow");
          await page.waitForTimeout(250);
        }
      }
    });
  });

  test("chinese_poker can render five consecutive UI hands", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=chinese_poker`);
    await expect(page.getByTestId("chinese-poker-screen")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Chinese Poker/i).first()).toBeVisible({ timeout: 20000 });

    for (let hand = 1; hand <= 5; hand += 1) {
      await expect(page.getByText(new RegExp(`(?:Hand|ハンド) #${hand}`, "i")).first()).toBeVisible({ timeout: 20000 });
      await expectChineseHeroCards(page);
      await expect(page.getByTestId("chinese-submit")).toBeEnabled({ timeout: 20000 });
      await page.getByTestId("chinese-submit").click();
      await expect(page.getByTestId("chinese-results")).toBeVisible({ timeout: 20000 });
      if (hand < 5) {
        await page.getByTestId("chinese-next-hand").click();
      }
    }
  });
});
