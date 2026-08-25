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
    variant: "badugi",
    title: /Badugi/i,
    street: "BET",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "D01",
    title: /2-7 Triple Draw/i,
    street: "BET",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "D02",
    title: /A-5 Triple Draw/i,
    street: "BET",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "S01",
    title: /2-7 Single Draw/i,
    street: "BET",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
  },
  {
    variant: "S02",
    title: /A-5 Single Draw/i,
    street: "BET",
    currentBet: 40,
    heroBet: 20,
    expectedAction: "call",
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
          typeof api.forceControllerAction === "function" &&
          typeof api.getLastControllerActionFailure === "function" &&
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
      const effectiveRaiseCount =
        capSnapshot?.controllerRaiseCount ??
        capSnapshot?.controllerSnapshot?.raiseStats?.raiseCountThisRound ??
        capSnapshot?.controllerSnapshot?.metadata?.raiseCountThisRound ??
        capSnapshot?.raiseCountThisRound;
      expect(effectiveRaiseCount).toBe(4);

      const rejectedRaise = await invokeE2E(page, "forceControllerAction", 0, {
        type: "raise",
        amount: 20,
      });
      expect(rejectedRaise).toBeFalsy();
      const failure = await invokeE2E(page, "getLastControllerActionFailure");
      expect(
        `${failure?.code ?? ""} ${failure?.message ?? ""} ${JSON.stringify(failure?.events ?? [])}`,
      ).toMatch(/cap|FL_RAISE_CAP|raise cap/i);

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
