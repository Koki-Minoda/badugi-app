import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type ProgressionCase = {
  variant: string;
  title: RegExp;
  expectedStreets: string[];
  minBoardCards?: number;
  minHeroCards?: number;
};

const BOARD_PROGRESSION_CASES: ProgressionCase[] = [
  {
    variant: "nlh",
    title: /No-Limit Hold'em|NL Hold'em/i,
    expectedStreets: ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"],
    minBoardCards: 5,
    minHeroCards: 2,
  },
  {
    variant: "flh",
    title: /FL Hold'em|Fixed-Limit Hold'em/i,
    expectedStreets: ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"],
    minBoardCards: 5,
    minHeroCards: 2,
  },
  {
    variant: "plo",
    title: /Pot-Limit Omaha|PLO/i,
    expectedStreets: ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"],
    minBoardCards: 5,
    minHeroCards: 4,
  },
  {
    variant: "plo8",
    title: /PLO8|Omaha Hi-Lo/i,
    expectedStreets: ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"],
    minBoardCards: 5,
    minHeroCards: 4,
  },
];

const STUD_PROGRESSION_CASES: ProgressionCase[] = [
  {
    variant: "stud",
    title: /^Stud$/i,
    expectedStreets: ["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"],
    minHeroCards: 3,
  },
  {
    variant: "stud8",
    title: /Stud 8|Stud8|Stud Hi-Lo/i,
    expectedStreets: ["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"],
    minHeroCards: 3,
  },
  {
    variant: "razz",
    title: /Razz/i,
    expectedStreets: ["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"],
    minHeroCards: 3,
  },
];

const DRAW_OPERATIONAL_CASES: ProgressionCase[] = [
  {
    variant: "badugi",
    title: /Badugi/i,
    expectedStreets: ["BET", "DRAW", "SHOWDOWN"],
    minHeroCards: 4,
  },
  {
    variant: "D01",
    title: /2-7 Triple Draw/i,
    expectedStreets: ["BET", "DRAW", "SHOWDOWN"],
    minHeroCards: 5,
  },
  {
    variant: "D02",
    title: /A-5 Triple Draw/i,
    expectedStreets: ["BET", "DRAW", "SHOWDOWN"],
    minHeroCards: 5,
  },
  {
    variant: "S01",
    title: /2-7 Single Draw/i,
    expectedStreets: ["BET", "DRAW", "SHOWDOWN"],
    minHeroCards: 5,
  },
];

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceControllerAction === "function" &&
          typeof api.forceDealNewHandNow === "function" &&
          typeof api.resolveHandNow === "function" &&
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

async function getStateSnapshot(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
}

async function getPhaseState(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
}

async function openVariant(page: Page, variant: string, title: RegExp) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
  await waitForE2EDriver(page);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  await invokeE2E(page, "forceDealNewHandNow");
  await page.waitForTimeout(250);
}

function currentActorFrom(snapshot: any) {
  const controller = snapshot?.controllerSnapshot;
  if (typeof controller?.currentActor === "number") return controller.currentActor;
  if (typeof controller?.turn === "number") return controller.turn;
  return null;
}

async function forceCurrentControllerAction(page: Page) {
  const state = await getStateSnapshot(page);
  const snapshot = state?.controllerSnapshot;
  const actor = currentActorFrom(state);
  if (typeof actor !== "number") return false;
  const player = snapshot?.players?.[actor];
  if (!player || player.folded || player.seatOut || player.allIn) return false;
  const toCall = Math.max(0, (snapshot?.currentBet ?? 0) - (player?.betThisStreet ?? 0));
  await invokeE2E(page, "forceControllerAction", actor, {
    type: toCall > 0 ? "call" : "check",
    amount: toCall,
  });
  return true;
}

async function driveControllerHandToShowdown(page: Page, expectedStreets: string[]) {
  const visited = new Set<string>();
  for (let step = 0; step < 180; step += 1) {
    const state = await getStateSnapshot(page);
    const snapshot = state?.controllerSnapshot;
    if (snapshot?.street) visited.add(snapshot.street);
    if (snapshot?.street === "SHOWDOWN" || snapshot?.lastHandResult || state?.phase === "HAND_RESULT") {
      return visited;
    }
    const acted = await forceCurrentControllerAction(page);
    await page.waitForTimeout(acted ? 120 : 220);
  }
  throw new Error(
    `Controller hand did not reach showdown. expected=${expectedStreets.join(",")} visited=${[
      ...visited,
    ].join(",")}`,
  );
}

async function expectHeroCards(page: Page, minCount: number) {
  for (let idx = 0; idx < minCount; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function expectTableNotStuck(page: Page) {
  await expect
    .poll(
      async () => {
        const phaseState = await getPhaseState(page);
        const state = await getStateSnapshot(page);
        const snapshot = state?.controllerSnapshot;
        const phase = phaseState?.phase ?? state?.phase ?? snapshot?.phase;
        const actor =
          typeof phaseState?.turn === "number" ? phaseState.turn : currentActorFrom(state);
        const players = phaseState?.players ?? snapshot?.players ?? [];
        const current = typeof actor === "number" ? players?.[actor] : null;
        if (phase === "BET" && current && (current.folded || current.seatOut || current.allIn)) {
          return `stuck-${actor}`;
        }
        return "ok";
      },
      { timeout: 25000 },
    )
    .toBe("ok");
}

test.describe("8/10Game core progression audit", () => {
  test.describe.configure({ timeout: 180000 });

  for (const testCase of [...BOARD_PROGRESSION_CASES, ...STUD_PROGRESSION_CASES]) {
    test(`${testCase.variant} reaches showdown through all required streets`, async ({ page }) => {
      await openVariant(page, testCase.variant, testCase.title);

      const visited = await driveControllerHandToShowdown(page, testCase.expectedStreets);

      expect([...visited]).toEqual(expect.arrayContaining(testCase.expectedStreets));
      if (testCase.minHeroCards) {
        await expectHeroCards(page, testCase.minHeroCards);
      }
      if (testCase.minBoardCards) {
        const state = await getStateSnapshot(page);
        expect(state?.controllerSnapshot?.boardCards?.length ?? 0).toBeGreaterThanOrEqual(
          testCase.minBoardCards,
        );
      }
      await invokeE2E(page, "forceDealNewHandNow");
      await expectHeroCards(page, testCase.minHeroCards ?? 2);
      await expectTableNotStuck(page);
    });
  }

  for (const testCase of DRAW_OPERATIONAL_CASES) {
    test(`${testCase.variant} survives five hands and forced showdown`, async ({ page }) => {
      await openVariant(page, testCase.variant, testCase.title);

      for (let hand = 0; hand < 5; hand += 1) {
        await expectHeroCards(page, testCase.minHeroCards ?? 4);
        await expectTableNotStuck(page);
        if (hand < 4) {
          await invokeE2E(page, "forceDealNewHandNow");
          await page.waitForTimeout(200);
        }
      }

      await invokeE2E(page, "resolveHandNow");
      await page.waitForTimeout(250);
      await invokeE2E(page, "forceDealNewHandNow");
      await expectHeroCards(page, testCase.minHeroCards ?? 4);
      await expectTableNotStuck(page);
    });
  }
});
