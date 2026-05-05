import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame, openAuthenticatedMenu } from "./authHelper";

async function expectHeroCards(page: Page, count: number) {
  for (let idx = 0; idx < count; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function expectActionPanelOrProgress(page: Page) {
  const actionButtons = page.locator(
    [
      "[data-testid='action-check']",
      "[data-testid='action-call']",
      "[data-testid='action-raise']",
      "[data-testid='action-fold']",
      "[data-testid='action-draw-selected']",
    ].join(","),
  );
  const progressText = page.getByText(/Waiting for other players|他のプレイヤー|待機/i).first();
  await expect
    .poll(async () => {
      const visibleCount = await actionButtons.evaluateAll((buttons) =>
        buttons.filter((button) => {
          const element = button as HTMLElement;
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && !element.hasAttribute("disabled");
        }).length,
      );
      if (visibleCount > 0) return visibleCount;
      if (await progressText.isVisible().catch(() => false)) return 1;
      if (await page.getByTestId("decision-panel").isVisible().catch(() => false)) return 1;
      return 0;
    }, { timeout: 25000 })
    .toBeGreaterThan(0);
}

test.describe("cross variant operational smoke", () => {
  test.describe.configure({ timeout: 90000 });

  [
    { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i, heroCards: 2 },
    { variant: "flh", title: /Fixed-Limit Hold'em|FL Hold'em/i, heroCards: 2 },
    { variant: "super_holdem", title: /Super Hold'em/i, heroCards: 3 },
    { variant: "fl_super_holdem", title: /FL Super Hold'em/i, heroCards: 3 },
    { variant: "plo", title: /Pot-Limit Omaha|PLO/i, heroCards: 4 },
    { variant: "plo8", title: /PLO8|Omaha Hi-Lo/i, heroCards: 4 },
    { variant: "big_o", title: /Big-O|5-Card Omaha Hi-Lo/i, heroCards: 5 },
    { variant: "five_card_plo", title: /5-Card PLO|Five-Card PLO/i, heroCards: 5 },
    { variant: "flo8", title: /FLO8|Fixed-Limit Omaha/i, heroCards: 4 },
    { variant: "stud", title: /Stud/i, heroCards: 3 },
    { variant: "stud8", title: /Stud 8/i, heroCards: 3 },
    { variant: "razz", title: /Razz/i, heroCards: 3 },
    { variant: "razz27", title: /2-7 Razz/i, heroCards: 3 },
    { variant: "razzdugi", title: /Razzdugi/i, heroCards: 3 },
    { variant: "razzducey", title: /Razzducey/i, heroCards: 3 },
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
  ].forEach(({ variant, title, heroCards }) => {
    test(`${variant} cash game deals hero cards and reaches stable table UI`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);

      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
      await expectHeroCards(page, heroCards);
      await expectActionPanelOrProgress(page);
    });
  });

  test("chinese_poker cash game renders playable Chinese Poker UI", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=chinese_poker`);

    await expect(page.getByTestId("chinese-poker-screen")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Chinese Poker/i).first()).toBeVisible({ timeout: 20000 });
    await expect
      .poll(async () => page.locator("[data-testid^='chinese-card-']").count(), { timeout: 20000 })
      .toBeGreaterThanOrEqual(13);
    await expect(page.getByTestId("chinese-submit")).toBeVisible({ timeout: 20000 });
  });

  test("Badugi store tournament deals hero cards and reaches an actionable hero state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedMenu(page);
    await page.getByTestId("menu-tournament").click();

    await expect(page.getByText(/Store Tournament/i).first()).toBeVisible({ timeout: 20000 });
    await expectHeroCards(page, 4);
    await expectActionPanelOrProgress(page);
  });
});
