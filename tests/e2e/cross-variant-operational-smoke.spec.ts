import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame, openAuthenticatedMenu } from "./authHelper";

async function expectHeroCards(page: Page, count: number) {
  for (let idx = 0; idx < count; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function expectActionOrProgress(page: Page) {
  const actionButtons = page.locator(
    [
      "[data-testid='action-check']",
      "[data-testid='action-call']",
      "[data-testid='action-raise']",
      "[data-testid='action-fold']",
      "[data-testid='action-draw-selected']",
    ].join(","),
  );
  await expect
    .poll(async () => {
      const visibleCount = await actionButtons.evaluateAll((buttons) =>
        buttons.filter((button) => {
          const element = button as HTMLElement;
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && !element.hasAttribute("disabled");
        }).length,
      );
      return visibleCount;
    }, { timeout: 25000 })
    .toBeGreaterThan(0);
}

test.describe("cross variant operational smoke", () => {
  test.describe.configure({ timeout: 90000 });

  [
    { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i, heroCards: 2 },
    { variant: "flh", title: /Fixed-Limit Hold'em|FL Hold'em/i, heroCards: 2 },
    { variant: "plo", title: /Pot-Limit Omaha|PLO/i, heroCards: 4 },
    { variant: "plo8", title: /PLO8|Omaha Hi-Lo/i, heroCards: 4 },
    { variant: "big_o", title: /Big-O|5-Card Omaha Hi-Lo/i, heroCards: 5 },
    { variant: "five_card_plo", title: /5-Card PLO|Five-Card PLO/i, heroCards: 5 },
    { variant: "stud", title: /Stud/i, heroCards: 3 },
    { variant: "razz", title: /Razz/i, heroCards: 3 },
  ].forEach(({ variant, title, heroCards }) => {
    test(`${variant} cash game deals hero cards and reaches an actionable hero state`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);

      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
      await expectHeroCards(page, heroCards);
      await expectActionOrProgress(page);
    });
  });

  test("Badugi store tournament deals hero cards and reaches an actionable hero state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedMenu(page);
    await page.getByTestId("menu-tournament").click();

    await expect(page.getByText(/Store Tournament/i).first()).toBeVisible({ timeout: 20000 });
    await expectHeroCards(page, 4);
    await expectActionOrProgress(page);
  });
});
