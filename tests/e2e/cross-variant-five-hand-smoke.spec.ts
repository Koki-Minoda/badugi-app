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

test.describe("cross variant five-hand UI smoke", () => {
  test.describe.configure({ timeout: 180000 });

  [
    { variant: "badugi", title: /Badugi/i, heroCards: 4 },
    { variant: "D01", title: /2-7 Triple Draw/i, heroCards: 5 },
    { variant: "D02", title: /A-5 Triple Draw/i, heroCards: 5 },
    { variant: "plo", title: /Pot-Limit Omaha|PLO/i, heroCards: 4 },
    { variant: "plo8", title: /PLO8|Omaha Hi-Lo/i, heroCards: 4 },
    { variant: "stud", title: /^Stud$/i, heroCards: 3 },
    { variant: "razz", title: /Razz/i, heroCards: 3 },
  ].forEach(({ variant, title, heroCards }) => {
    test(`${variant} can render five consecutive UI hands`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
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
});
