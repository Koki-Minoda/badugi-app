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

const MIXED_ROTATION_CASES = [
  {
    label: "8Game",
    rotation: [
      "nlh",
      "flh",
      "plo8",
      "razz",
      "stud",
      "stud8",
      "deuce_to_seven_triple_draw",
      "plo",
    ],
    cycles: 5,
  },
  {
    label: "10Game",
    rotation: [
      "nlh",
      "flh",
      "plo8",
      "razz",
      "stud",
      "stud8",
      "deuce_to_seven_triple_draw",
      "plo",
      "badugi",
      "deuce_to_seven_single_draw",
    ],
    cycles: 5,
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

function stableSeatSignature(snapshot: any) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  return players.map((player: any) => player?.name ?? player?.id ?? `seat-${player?.seatIndex}`);
}

function tableChipTotal(snapshot: any) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const playerTotal = players.reduce((sum: number, player: any) => {
    const stack = Number(player?.stack ?? 0);
    const bet = Number(player?.bet ?? 0);
    return sum + (Number.isFinite(stack) ? stack : 0) + (Number.isFinite(bet) ? bet : 0);
  }, 0);
  const potTotal = Number(snapshot?.potTotal ?? 0);
  return playerTotal + (Number.isFinite(potTotal) ? potTotal : 0);
}

async function startMixedRotationTournament(page: Page, label: string, rotation: string[]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${rotation[0]}`);
  await waitForE2EDriver(page);
  await invokeE2E(page, "startTournamentMTT", {
    id: `${label.toLowerCase()}-rotation-e2e`,
    name: `${label} Rotation E2E`,
    tables: 1,
    seatsPerTable: 6,
    startingStack: 5000,
    gameVariant: rotation[0],
    gameRotation: rotation,
    rotationPolicy: "per-hand",
    levels: [
      { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 },
    ],
    payouts: [{ place: 1, percent: 100 }],
  });
  await page.waitForFunction(
    ({ firstVariant, rotationLength }) => {
      const api = window.__BADUGI_E2E__;
      const snapshot = api?.getStateSnapshot?.();
      if (snapshot?.gameVariant !== firstVariant) return false;
      return Array.isArray(snapshot?.rotation?.sequence) &&
        snapshot.rotation.sequence.length === rotationLength;
    },
    { firstVariant: rotation[0], rotationLength: rotation.length },
    { timeout: 20000 },
  );
}

async function completeRotationBoundary(page: Page) {
  await invokeE2E(page, "resolveHandNow");
  await page.waitForTimeout(150);
  await invokeE2E(page, "dealNewHandNow");
  await page.waitForTimeout(250);
}

async function expectRotationSnapshot(
  page: Page,
  {
    expectedVariant,
    expectedRotation,
    expectedSeatSignature,
    expectedChipTotal,
    stepLabel,
  }: {
    expectedVariant: string;
    expectedRotation: string[];
    expectedSeatSignature: string[];
    expectedChipTotal: number;
    stepLabel: string;
  },
) {
  const snapshot = await getStateSnapshot(page);
  expect(snapshot, `${stepLabel}: snapshot`).toBeTruthy();
  expect(snapshot?.gameVariant, `${stepLabel}: gameVariant`).toBe(expectedVariant);
  expect(snapshot?.rotation?.currentVariant, `${stepLabel}: rotation current`).toBe(
    expectedVariant,
  );
  expect(snapshot?.rotation?.sequence, `${stepLabel}: rotation sequence`).toEqual(
    expectedRotation,
  );
  expect(stableSeatSignature(snapshot), `${stepLabel}: seat identity handoff`).toEqual(
    expectedSeatSignature,
  );
  expect(tableChipTotal(snapshot), `${stepLabel}: table chip conservation`).toBe(
    expectedChipTotal,
  );
  expect(typeof snapshot?.dealerIdx, `${stepLabel}: dealerIdx type`).toBe("number");
  expect(snapshot.dealerIdx, `${stepLabel}: dealerIdx lower bound`).toBeGreaterThanOrEqual(0);
  expect(snapshot.dealerIdx, `${stepLabel}: dealerIdx upper bound`).toBeLessThan(
    expectedSeatSignature.length,
  );
  expect(Number(snapshot?.handCount ?? 0), `${stepLabel}: handCount`).toBeGreaterThanOrEqual(0);
  await expectTableNotStuck(page);
  return snapshot;
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

  for (const rotationCase of MIXED_ROTATION_CASES) {
    test(`MIX-PROG-05 ${rotationCase.label} preserves seats/buttons/stacks across five rotation cycles`, async ({
      page,
    }) => {
      test.setTimeout(240000);
      await startMixedRotationTournament(page, rotationCase.label, rotationCase.rotation);

      await completeRotationBoundary(page);
      const initial = await getStateSnapshot(page);
      const expectedSeatSignature = stableSeatSignature(initial);
      const expectedChipTotal = tableChipTotal(initial);
      expect(expectedSeatSignature.length, `${rotationCase.label}: seats`).toBe(6);
      expect(new Set(expectedSeatSignature).size, `${rotationCase.label}: duplicate seats`).toBe(6);
      expect(expectedChipTotal, `${rotationCase.label}: initial chip total`).toBe(30000);

      await expectRotationSnapshot(page, {
        expectedVariant: rotationCase.rotation[1 % rotationCase.rotation.length],
        expectedRotation: rotationCase.rotation,
        expectedSeatSignature,
        expectedChipTotal,
        stepLabel: `${rotationCase.label} bootstrap boundary`,
      });

      const totalBoundaries = rotationCase.rotation.length * rotationCase.cycles;
      for (let boundary = 1; boundary <= totalBoundaries; boundary += 1) {
        await completeRotationBoundary(page);
        const expectedVariant =
          rotationCase.rotation[(boundary + 1) % rotationCase.rotation.length];
        await expectRotationSnapshot(page, {
          expectedVariant,
          expectedRotation: rotationCase.rotation,
          expectedSeatSignature,
          expectedChipTotal,
          stepLabel: `${rotationCase.label} boundary ${boundary}/${totalBoundaries}`,
        });
      }
    });
  }
});
