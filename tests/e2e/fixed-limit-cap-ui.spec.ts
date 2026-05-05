import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type CapCase = {
  variant: string;
  title: RegExp;
  street: string;
  currentBet: number;
  heroBet: number;
  expectedAction: "call" | "check";
};

const CAP_UI_CASES: CapCase[] = [
  {
    variant: "flh",
    title: /FL Hold'em|Fixed-Limit Hold'em/i,
    street: "FLOP",
    currentBet: 80,
    heroBet: 60,
    expectedAction: "call",
  },
  {
    variant: "flo8",
    title: /FLO8|Omaha Hi-Lo/i,
    street: "FLOP",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "stud",
    title: /^Stud$/i,
    street: "FOURTH",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "flh",
    title: /FL Hold'em|Fixed-Limit Hold'em/i,
    street: "FLOP",
    currentBet: 80,
    heroBet: 80,
    expectedAction: "check",
  },
];

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceDealNewHandNow === "function" &&
          typeof api.setupFixedLimitCapFixtureForTest === "function" &&
          typeof api.getStateSnapshot === "function" &&
          typeof api.getCurrentHandHistory === "function",
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

async function openVariant(page: Page, variant: string, title: RegExp) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
  await waitForE2EDriver(page);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  await invokeE2E(page, "forceDealNewHandNow");
}

async function setupCapSpot(page: Page, testCase: CapCase) {
  await invokeE2E(page, "setupFixedLimitCapFixtureForTest", {
    street: testCase.street,
    currentBet: testCase.currentBet,
    heroBet: testCase.heroBet,
  });
  await page.waitForFunction(
    ({ expectedBet, expectedHeroBet }) => {
      const snapshot = window.__BADUGI_E2E__?.getStateSnapshot?.();
      const hero = snapshot?.players?.[0];
      return (
        snapshot?.phase === "BET" &&
        snapshot?.turn === 0 &&
        snapshot?.controllerSnapshot?.currentActor === 0 &&
        Number(snapshot?.controllerSnapshot?.currentBet ?? 0) === expectedBet &&
        Number(hero?.bet ?? 0) === expectedHeroBet
      );
    },
    { expectedBet: testCase.currentBet, expectedHeroBet: testCase.heroBet },
    { timeout: 10000 },
  );
}

function heroBetEvents(record: any) {
  return (Array.isArray(record?.events) ? record.events : []).filter(
    (event: any) => event?.type === "BET_ACTION" && event?.seat === 0,
  );
}

test.describe("CAP-REG-05 fixed-limit cap UI", () => {
  test.describe.configure({ timeout: 120000 });

  for (const testCase of CAP_UI_CASES) {
    test(`${testCase.variant} cap reached hides Raise and records ${testCase.expectedAction}`, async ({
      page,
    }) => {
      await openVariant(page, testCase.variant, testCase.title);
      await setupCapSpot(page, testCase);

      const panel = page.getByTestId("action-context-panel");
      await expect(panel).toContainText("Raise Cap");
      await expect(panel).toContainText("4/4");
      await expect(page.getByTestId("action-raise")).toHaveCount(0);
      const capSnapshot = await page.evaluate(
        () => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null,
      );
      expect(capSnapshot?.controllerRaiseCount).toBe(4);

      const actionButton =
        testCase.expectedAction === "call"
          ? page.getByTestId("action-call")
          : page.getByTestId("action-check");
      await expect(actionButton).toBeVisible({ timeout: 10000 });
      await actionButton.click();

      await expect
        .poll(
          async () => {
            const record = await page.evaluate(
              () => window.__BADUGI_E2E__?.getCurrentHandHistory?.() ?? null,
            );
            const actions = heroBetEvents(record);
            const last = actions[actions.length - 1];
            return last?.action ?? "";
          },
          { timeout: 10000 },
        )
        .toBe(testCase.expectedAction);

      const history = await page.evaluate(
        () => window.__BADUGI_E2E__?.getCurrentHandHistory?.() ?? null,
      );
      const lastHeroAction = heroBetEvents(history).at(-1);
      expect(lastHeroAction?.metadata?.betInfo?.capReached).toBe(true);
      expect(lastHeroAction?.metadata?.betInfo?.canRaise).toBe(false);
      expect(lastHeroAction?.metadata?.betInfo?.raiseCountTable).toBe(4);
    });
  }
});
