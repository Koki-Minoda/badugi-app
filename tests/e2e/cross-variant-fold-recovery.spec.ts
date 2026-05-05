import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type VariantCase = {
  variant: string;
  title: RegExp;
  heroCards: number;
};

const VARIANTS: VariantCase[] = [
  { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i, heroCards: 2 },
  { variant: "flh", title: /Fixed-Limit Hold'em|FL Hold'em/i, heroCards: 2 },
  { variant: "super_holdem", title: /Super Hold'em/i, heroCards: 3 },
  { variant: "fl_super_holdem", title: /FL Super Hold'em/i, heroCards: 3 },
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
];

const SESSION_DRAW_VARIANTS = new Set([
  "D01",
  "D02",
  "badugi",
  "D04",
  "D05",
  "D06",
  "D07",
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
]);

const BOARD_VARIANTS = new Set([
  "nlh",
  "flh",
  "super_holdem",
  "fl_super_holdem",
  "plo",
  "plo8",
  "big_o",
  "five_card_plo",
  "flo8",
]);

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceDealNewHandNow === "function" &&
          typeof api.resolveHandNow === "function" &&
          typeof api.forceMarkSeatFoldedForTest === "function" &&
          typeof api.getPhaseState === "function" &&
          typeof api.getStateSnapshot === "function",
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

async function readHeroState(page: Page) {
  return page.evaluate(() => {
    const api = window.__BADUGI_E2E__;
    const phaseState = api?.getPhaseState?.();
    const controllerState = api?.getStateSnapshot?.();
    const controllerHero = controllerState?.controllerSnapshot?.players?.[0];
    const legacyHero = phaseState?.players?.[0];
    return {
      phase: phaseState?.phase ?? controllerState?.controllerSnapshot?.phase,
      turn: phaseState?.turn ?? controllerState?.controllerSnapshot?.currentActor,
      hero: legacyHero ?? controllerHero ?? null,
      controllerHero: controllerHero ?? null,
    };
  });
}

async function expectHeroCards(page: Page, count: number) {
  for (let idx = 0; idx < count; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function clickHeroFoldWhenAvailable(page: Page) {
  const foldButton = page.getByTestId("action-fold");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await foldButton.isVisible().catch(() => false)) {
      await foldButton.click();
      return;
    }
    await invokeE2E(page, "forceDealNewHandNow");
    await page.waitForTimeout(250);
  }
  throw new Error("Hero fold action did not become available");
}

async function foldHero(page: Page, variant: string) {
  if (!BOARD_VARIANTS.has(variant) || SESSION_DRAW_VARIANTS.has(variant)) {
    const marked = await invokeE2E(page, "forceMarkSeatFoldedForTest", 0);
    expect(marked).toBe(true);
    return;
  }
  await clickHeroFoldWhenAvailable(page);
}

test.describe("cross variant fold recovery", () => {
  test.describe.configure({ timeout: 180000 });

  VARIANTS.forEach(({ variant, title, heroCards }) => {
    test(`${variant} lets hero join the next hand after folding`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
      await expectHeroCards(page, heroCards);

      await foldHero(page, variant);
      await expect
        .poll(async () => (await readHeroState(page))?.hero?.folded, { timeout: 20000 })
        .toBe(true);

      await invokeE2E(page, "resolveHandNow");
      await page.waitForTimeout(200);
      const startedNextHand = await invokeE2E(page, "dealNewHandNow");
      expect(startedNextHand).toBe(true);
      await page.waitForTimeout(250);

      await expectHeroCards(page, heroCards);
      const after = await readHeroState(page);
      expect(after.hero?.folded).not.toBe(true);
      expect(after.hero?.hasFolded).not.toBe(true);
      expect(after.hero?.seatOut).not.toBe(true);
      expect(after.hero?.allIn).not.toBe(true);
    });
  });
});
