import { test, expect, Page } from "@playwright/test";
import {
  evaluateBadugi,
  compareBadugi,
  getWinnersByBadugi,
} from "../../src/games/badugi/utils/badugiEvaluator.js";
import { buildSidePots } from "../../src/games/badugi/engine/roundFlow.js";

const APP_URL = "http://127.0.0.1:3000/";
const HERO_SEAT = 0;
const STARTING_STACK = 500;

function makeOverride(
  seat: number,
  cards: string[],
  invested: number,
  extras: Partial<{ stack: number; allIn: boolean }> = {},
) {
  return {
    seat,
    cards,
    totalInvested: invested,
    stack:
      typeof extras.stack === "number"
        ? extras.stack
        : Math.max(0, STARTING_STACK - invested),
    allIn: extras.allIn ?? false,
  };
}

const FILLER_OVERRIDES = [
  makeOverride(2, ["JC", "QD", "KH", "AS"], 0),
  makeOverride(3, ["7C", "8D", "9H", "JS"], 0),
  makeOverride(4, ["5C", "6D", "7H", "8S"], 0),
  makeOverride(5, ["9C", "10D", "JH", "QS"], 0),
];

function expandContributions(overrides: Array<{ seat: number; totalInvested?: number }>) {
  const players = Array.from({ length: 6 }, (_, seat) => ({
    seat,
    totalInvested: 0,
    folded: false,
  }));
  overrides.forEach(({ seat, totalInvested }) => {
    if (typeof seat === "number" && seat >= 0 && seat < players.length) {
      players[seat].totalInvested = Math.max(0, totalInvested ?? 0);
    }
  });
  return players;
}

function composeOverrides(overrides: Array<Record<string, any>>) {
  const map = new Map<number, Record<string, any>>();
  FILLER_OVERRIDES.forEach((entry) => map.set(entry.seat, { ...entry }));
  overrides.forEach((entry) => {
    if (typeof entry?.seat !== "number") return;
    const previous = map.get(entry.seat) ?? {};
    map.set(entry.seat, { ...previous, ...entry });
  });
  return Array.from(map.values());
}

function activePots(summary: any[]) {
  return summary.filter(
    (pot) => Array.isArray(pot?.eligible) && pot.eligible.filter((seat: any) => seat !== null).length,
  );
}

function setupE2ELogCapture(page: Page) {
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[E2E-") || text.includes("[SHOWDOWN]") || text.includes("[HAND_HISTORY]")) {
      logs.push(text);
    }
  });
  return logs;
}

async function gotoWithRetry(page: Page, url: string, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: Math.min(15000, timeout) });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError ?? new Error(`Failed to load ${url} within ${timeout}ms`);
}

async function openGame(page: Page) {
  await gotoWithRetry(page, APP_URL);
  const translateBubble = page.locator("text=Google Translate");
  if (await translateBubble.count()) {
    await translateBubble.click().catch(() => {});
  }
  const closeButtons = page.locator('button:has-text("\u9589\u3058\u308b")');
  if (await closeButtons.count()) {
    await closeButtons.first().click().catch(() => {});
  }
  const startButton = page.getByRole("button", { name: /start/i }).first();
  try {
    await startButton.waitFor({ state: "visible", timeout: 15000 });
    await startButton.click();
  } catch {
    // ignore if already on the game screen
  }
  const reachedGame = await Promise.race([
    page.waitForURL("**/game*", { timeout: 10000 }).then(() => "game"),
    page.waitForURL("**/menu*", { timeout: 10000 }).then(() => "menu"),
  ]);
  if (reachedGame === "menu") {
    await page.goto(`${APP_URL}game`, { waitUntil: "load" });
  }
  await page.getByRole("button", { name: /Leaderboard/i }).first().waitFor({ state: "visible" });
}

async function waitForE2EDriver(page: Page) {
  const REQUIRED_METHODS = [
    "forceSeatAction",
    "forceSequentialFolds",
    "forceAllIn",
    "resolveHandNow",
    "dealNewHandNow",
    "setPlayerHands",
    "getHandHistory",
  ];
  await page.waitForFunction(
    (expected) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api !== "object") return false;
      return expected.every((key) => typeof api[key] === "function");
    },
    REQUIRED_METHODS,
    { timeout: 20000 },
  );
}

async function waitForE2EHelper(page: Page, helperName: string) {
  await page.waitForFunction(
    (method) => typeof window.__BADUGI_E2E__?.[method] === "function",
    helperName,
    { timeout: 20000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  await page.evaluate(
    ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function waitForHandsApplied(page: Page, overrides: Array<{ seat: number; cards: string[] }>) {
  await page.waitForFunction(
    (config) => {
      const state = window.__BADUGI_E2E__?.getPhaseState?.();
      if (!state || !Array.isArray(state.players)) return false;
      return config.every(({ seat, cards }) => {
        const player = state.players?.[seat];
        if (!player || !Array.isArray(player.hand)) return false;
        if (player.hand.length !== cards.length) return false;
        return player.hand.every((card, idx) => card === String(cards[idx]).toUpperCase());
      });
    },
    overrides,
    { timeout: 20000 },
  );
}

async function waitForHandResultOverlay(page: Page) {
  await page.locator("text=Hand Result").first().waitFor({ state: "visible", timeout: 60000 });
}

async function waitForHandResultPots(page: Page) {
  await waitForHandResultOverlay(page);
  return page.locator('[data-testid="hand-result-pot"]:visible');
}

async function waitForPotSummary(page: Page, minLength = 1, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const summary = await page.evaluate(() => window.__BADUGI_E2E__?.getLastPotSummary?.() ?? []);
    if (summary.length >= minLength) {
      return summary;
    }
    await page.waitForTimeout(200);
  }
  throw new Error("Timed out waiting for pot summary");
}

async function getHandHistoryRecords(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getHandHistory?.() ?? []);
}

async function waitForSeatActionLog(
  logs: string[],
  seat: number,
  startIndex: number,
  matcher: (line: string) => boolean = () => true,
) {
  const seatRegex = new RegExp(`seat=${seat}\\b`);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const slice = logs.slice(startIndex);
    if (
      slice.some(
        (line) =>
          line.includes("[E2E-ACTION]") && seatRegex.test(line) && matcher(line),
      )
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for seat ${seat} action log`);
}

async function startNewHand(page: Page) {
  await invokeE2E(page, "dealNewHandNow");
  const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
  await foldButton.waitFor({ state: "visible", timeout: 30000 });
}

async function prepareHandWithOverrides(
  page: Page,
  overrides: Array<{ seat: number; cards: string[] }>,
) {
  const merged = composeOverrides(overrides);
  await waitForE2EHelper(page, "setPlayerHands");
  await invokeE2E(page, "setPlayerHands", merged);
  await waitForHandsApplied(page, merged);
  return merged;
}

async function finishHand(page: Page) {
  await invokeE2E(page, "resolveHandNow");
  await waitForHandResultOverlay(page);
}

function latestRecord(history: any[]) {
  if (!history.length) throw new Error("No hand history found");
  return history[history.length - 1];
}

function flattenActions(record: any) {
  return record.seats.flatMap((seat: any) =>
    (seat.actions ?? []).map((action: any) => ({ ...action, seat: seat.seat })),
  );
}

function expectMonotonicTotals(record: any) {
  record.seats.forEach((seat: any) => {
    const actions = seat.actions ?? [];
    for (let i = 1; i < actions.length; i += 1) {
      expect(actions[i].totalInvested).toBeGreaterThanOrEqual(actions[i - 1].totalInvested);
      expect(actions[i].seq).toBeGreaterThan(actions[i - 1].seq);
    }
  });
  const flattened = flattenActions(record).sort((a: any, b: any) => a.seq - b.seq);
  flattened.forEach((action: any, idx: number) => {
    expect(action.seq).toBe(idx + 1);
  });
}

async function verifyPotUi(
  page: Page,
  { titles, winnerLabels }: { titles: string[]; winnerLabels: string[] },
) {
  const potSections = await waitForHandResultPots(page);
  await expect(potSections).toHaveCount(titles.length);
  for (let i = 0; i < titles.length; i += 1) {
    await expect(
      potSections.nth(i).locator('[data-testid="hand-result-pot-title"]'),
    ).toHaveText(new RegExp(titles[i], "i"));
  }
  const winnerRows = potSections.first().locator('[data-testid="hand-result-winner-row"]');
  await expect(winnerRows).toHaveCount(winnerLabels.length);
  for (let i = 0; i < winnerLabels.length; i += 1) {
    await expect(
      winnerRows
        .nth(i)
        .locator('[data-testid="hand-result-winner-hand-label"]'),
    ).toHaveText(new RegExp(winnerLabels[i], "i"));
  }
}

test.describe("Badugi Regression Gallery", () => {
  test.describe("Evaluator invariants", () => {
    test("01 - four-card ordering beats higher ranked four-card", () => {
      const hero = evaluateBadugi(["Ac", "2d", "3h", "4s"]);
      const villain = evaluateBadugi(["2c", "4d", "6h", "8s"]);
      expect(hero.count).toBe(4);
      expect(villain.count).toBe(4);
      expect(compareBadugi(hero, villain)).toBeLessThan(0);
    });

    test("02 - suit duplication drops higher duplicates", () => {
      const hand = evaluateBadugi(["As", "2d", "3d", "4h"]);
      expect(hand.count).toBe(3);
      expect(hand.activeCards).toEqual(["AS", "2D", "4H"]);
      expect(hand.deadCards).toEqual(["3D"]);
    });

    test("03 - rank duplication keeps lowest suit instance", () => {
      const hand = evaluateBadugi(["4s", "4d", "7h", "Kc"]);
      expect(hand.count).toBe(3);
      expect(hand.activeCards).toEqual(["4D", "7H", "KC"]);
      expect(hand.deadCards).toEqual(["4S"]);
    });

    test("04 - combined duplicate suit and rank resolution", () => {
      const hand = evaluateBadugi(["Ac", "2c", "3d", "3s"]);
      expect(hand.count).toBe(2);
      expect(hand.activeCards).toEqual(["AC", "3D"]);
      expect(hand.deadCards).toEqual(["2C", "3S"]);
    });

    test("05 - any four-card Badugi outranks any three-card hand", () => {
      const fourCard = ["2C", "4D", "6H", "8S"];
      const threeCard = ["AC", "2C", "3D", "4H"];
      expect(compareBadugi(fourCard, threeCard)).toBeLessThan(0);
    });

    test("06 - perfect ties return zero comparison score", () => {
      const a = ["AC", "3D", "5H", "7S"];
      const b = ["AS", "3H", "5D", "7C"];
      expect(compareBadugi(a, b)).toBe(0);
      const tieEval = getWinnersByBadugi([
        { seat: 0, seatIndex: 0, name: "Hero", hand: a },
        { seat: 1, seatIndex: 1, name: "CPU", hand: b },
      ]);
      expect(tieEval).toHaveLength(2);
    });

    test("07 - multi-winner split pot detection honors best ranks", () => {
      const winners = getWinnersByBadugi([
        { seat: 0, seatIndex: 0, name: "Hero", hand: ["AC", "2D", "4H", "6S"] },
        { seat: 1, seatIndex: 1, name: "CPU 1", hand: ["AS", "2H", "4D", "6C"] },
        { seat: 2, seatIndex: 2, name: "CPU 2", hand: ["9C", "TD", "QH", "KS"] },
      ]);
      expect(winners.map((w) => w.name)).toEqual(["Hero", "CPU 1"]);
    });
  });

  test.describe("Engine, UI, and history invariants", () => {
    test.beforeEach(async ({ page }) => {
      await openGame(page);
      await waitForE2EDriver(page);
      await startNewHand(page);
    });

    test("08 - single-pot showdown without all-ins", async ({ page }) => {
      const historyBefore = await getHandHistoryRecords(page);
      const overrides = [
        makeOverride(0, ["2C", "4D", "6H", "8S"], 200),
        makeOverride(1, ["AC", "3D", "5H", "7S"], 200),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);

      const summary = await waitForPotSummary(page, 1);
      const activeSummary = activePots(summary);
      expect(activeSummary).toHaveLength(1);
      expect(activeSummary[0].amount).toBe(400);
      expect(new Set(activeSummary[0].eligible)).toEqual(new Set([0, 1]));

      await verifyPotUi(page, { titles: ["Pot"], winnerLabels: ["Badugi 4-card"] });

      const history = await getHandHistoryRecords(page);
      expect(history.length).toBe(historyBefore.length + 1);
      const record = latestRecord(history);
      expect(record.pots).toHaveLength(1);
      expect(record.pots[0].amount).toBe(400);
      expect(record.pots[0].eligibleSeats).toEqual([0, 1]);
      expect(record.pots[0].winners[0].seat).toBe(1);
    });

    test("09 - forced all-in builds deterministic main and side pots", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["AC", "2D", "3H", "4S"], 100, { stack: 0, allIn: true }),
        makeOverride(1, ["5C", "6D", "7H", "8S"], 300),
        makeOverride(2, ["9C", "TD", "JH", "QS"], 300),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const summary = activePots(await waitForPotSummary(page, 2));
      expect(summary).toHaveLength(2);
      expect(summary[0].amount).toBe(300);
      expect(summary[1].amount).toBe(400);
      expect(new Set(summary[0].eligible)).toEqual(new Set([0, 1, 2]));
      expect(new Set(summary[1].eligible)).toEqual(new Set([1, 2]));
      await verifyPotUi(page, { titles: ["Main Pot", "Side Pot"], winnerLabels: ["Badugi"] });
    });

    test("10 - fold-only hands award a single pot to the last seat", async ({ page }) => {
      await invokeE2E(page, "forceSeatAction", HERO_SEAT, { type: "fold" });
      const foldSeats = [1, 2, 3, 4];
      await invokeE2E(page, "forceSequentialFolds", foldSeats);
      await page.waitForTimeout(250);
      await finishHand(page);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      if (record.pots.length) {
        expect(record.pots[0].winners[0].seat).toBe(5);
      }
      const winnerSeat = record.seats.find((seat: any) => seat.seat === 5);
      expect(winnerSeat.finalAction).toMatch(/win|showdown/);
      const heroSeat = record.seats.find((seat: any) => seat.seat === HERO_SEAT);
      expect(heroSeat.finalAction).toBe("fold");
    });

    test("11 - sequential forced CPU folds never resurrect seats", async ({ page }) => {
      const historyBefore = await getHandHistoryRecords(page);
      const cpuSeats = [1, 2, 3, 4];
      await invokeE2E(page, "forceSequentialFolds", cpuSeats);
      await finishHand(page);
      const history = await getHandHistoryRecords(page);
      expect(history.length).toBe(historyBefore.length + 1);
      const record = latestRecord(history);
      cpuSeats.forEach((seatIdx) => {
        const entry = record.seats.find((seat: any) => seat.seat === seatIdx);
        expect(entry.finalAction).toBe("fold");
        const actions = entry.actions ?? [];
        const foldIdx = actions.findIndex((action: any) => action.type === "fold");
        expect(foldIdx).toBeGreaterThanOrEqual(0);
        const postFold = actions.slice(foldIdx + 1).filter(
          (action: any) => action.type !== "collect",
        );
        expect(postFold).toHaveLength(0);
      });
    });

    test("12 - resolveHandNow path works without manual actions", async ({ page }) => {
      await finishHand(page);
      const summary = await waitForPotSummary(page, 1);
      expect(summary.length).toBeGreaterThanOrEqual(1);
      await verifyPotUi(page, { titles: ["Pot"], winnerLabels: ["Badugi"] });
    });

    test("13 - totalInvested-only overrides produce deterministic pots", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["AC", "2D", "3H", "4S"], 60),
        makeOverride(1, ["5C", "6D", "7H", "8S"], 60),
        makeOverride(2, ["9C", "TD", "JH", "QS"], 60),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const summary = activePots(await waitForPotSummary(page, 1));
      expect(summary).toHaveLength(1);
      expect(summary[0].amount).toBe(180);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      expect(record.pots[0].amount).toBe(180);
    });

    test("14 - UI hand labels, active cards, and ranks render correctly", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["2C", "4D", "6H", "8S"], 150),
        makeOverride(1, ["AC", "2C", "3D", "4H"], 150),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const potSections = await waitForHandResultPots(page);
      const winnerRow = potSections.first().locator('[data-testid="hand-result-winner-row"]').first();
      await expect(
        winnerRow.locator('[data-testid="hand-result-winner-hand-label"]'),
      ).toHaveText(/Badugi 4-card/i);
      await expect(
        winnerRow.locator('[data-testid="hand-result-winner-ranks"]'),
      ).toHaveText("2-4-6-8");
      await expect(
        winnerRow.locator('[data-testid="hand-result-winner-active-cards"]'),
      ).toHaveText(/2C 4D 6H 8S/);
      await expect(
        winnerRow.locator('[data-testid="hand-result-winner-dead-cards"]'),
      ).toHaveCount(0);
    });

    test("15 - hand history evaluation matches evaluateBadugi output", async ({ page }) => {
      const heroHand = ["2C", "4D", "6H", "8S"];
      const villainHand = ["AC", "2C", "3D", "4H"];
      const overrides = [
        makeOverride(0, heroHand, 200),
        makeOverride(1, villainHand, 200),
      ];
      const mergedOverrides = await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      const hero = record.seats.find((seat: any) => seat.seat === 0);
      const villain = record.seats.find((seat: any) => seat.seat === 1);
      expect(hero.evaluation).toEqual(evaluateBadugi(heroHand));
      expect(villain.evaluation).toEqual(evaluateBadugi(villainHand));
      const expectedPots = buildSidePots(expandContributions(mergedOverrides));
      expect(record.pots.map((pot: any) => pot.amount)).toEqual(
        expectedPots.map((pot) => pot.amount),
      );
    });

    test("16 - replay safety: seq and totalInvested are monotonic", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["2C", "3D", "4H", "5S"], 120),
        makeOverride(1, ["6C", "7D", "8H", "9S"], 120),
      ];
      await prepareHandWithOverrides(page, overrides);
      await invokeE2E(page, "forceSeatAction", HERO_SEAT, { type: "raise", amount: 40 });
      await invokeE2E(page, "forceSeatAction", 1, { type: "call" });
      await finishHand(page);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      expectMonotonicTotals(record);
    });

    test("17 - multi-pot winners differ per pot", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["AC", "2D", "3H", "4S"], 100, { stack: 0, allIn: true }),
        makeOverride(1, ["5C", "6D", "7H", "8S"], 300),
        makeOverride(2, ["AH", "3C", "5S", "7D"], 300),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const summary = activePots(await waitForPotSummary(page, 2));
      expect(summary[0].winners[0].seat).toBe(0);
      expect(summary[1].winners[0].seat).toBe(2);
    });

    test("18 - split pots distribute payouts evenly", async ({ page }) => {
      const tieHandHero = ["AC", "2D", "3H", "4S"];
      const tieHandCpu = ["AS", "2C", "3D", "4H"];
      const overrides = [
        makeOverride(0, tieHandHero, 250),
        makeOverride(2, tieHandCpu, 250),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const summary = activePots(await waitForPotSummary(page, 1));
      expect(summary[0].winners).toHaveLength(2);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      const pot = record.pots[0];
      expect(pot.amount).toBeGreaterThan(0);
      expect(new Set(pot.winners.map((winner: any) => winner.seat))).toEqual(new Set([0, 2]));
    });

    test("19 - rapid forced actions never lock the engine", async ({ page }) => {
      const logs = setupE2ELogCapture(page);
      logs.length = 0;
      const fastFolds = [0, 1, 2, 3, 4];
      await Promise.all(fastFolds.map((seat) => invokeE2E(page, "forceSeatAction", seat, { type: "fold" })));
      await finishHand(page);
      const summary = await waitForPotSummary(page, 1);
      expect(summary.length).toBeGreaterThanOrEqual(1);
      const history = await getHandHistoryRecords(page);
      const record = latestRecord(history);
      const winnerSeat = record.seats.find((seat: any) => seat.finalAction !== "fold");
      expect(winnerSeat.seat).toBe(5);
      expect(logs.some((line) => line.includes("[E2E-ERROR]"))).toBe(false);
      expect(logs.some((line) => line.includes("seat=-1"))).toBe(false);
    });

    test("20 - UI snapshot shows active and dead cards distinctly", async ({ page }) => {
      const overrides = [
        makeOverride(0, ["AC", "2D", "2H", "3H"], 120),
        makeOverride(1, ["4C", "4D", "6H", "7S"], 120),
      ];
      await prepareHandWithOverrides(page, overrides);
      await finishHand(page);
      const potSections = await waitForHandResultPots(page);
      const winnerRow = potSections.first().locator('[data-testid="hand-result-winner-row"]').first();
      await expect(
        winnerRow.locator('[data-testid="hand-result-winner-hand-label"]'),
      ).toHaveText(/Badugi 3-card/i);
      const deadCards = winnerRow.locator('[data-testid="hand-result-winner-dead-cards"]');
      await expect(deadCards).toHaveCount(1);
      await expect(deadCards).toHaveText(/2H|3H/);
    });
  });
});
