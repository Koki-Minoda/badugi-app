import { test, expect, Page } from "@playwright/test";
import {
  evaluateBadugi,
  compareBadugi,
  getWinnersByBadugi,
} from "../../src/games/badugi/utils/badugiEvaluator.js";

const APP_URL = "http://127.0.0.1:3000/";

const hasStreet = (line: string, street: string) =>
  line.toLowerCase().includes(`street=${street.toLowerCase()}`);

function setupE2ELogCapture(page: Page) {
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[E2E-") || text.includes("[SHOWDOWN]")) {
      logs.push(text);
    }
  });
  return logs;
}

async function waitForCondition(predicate: () => boolean, timeout = 20000, interval = 100) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error("timeout waiting for condition"));
        return;
      }
      setTimeout(check, interval);
    };
    check();
  });
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
    // already on game screen
  }
  const reachedGame = await Promise.race([
    page.waitForURL("**/game*", { timeout: 10000 }).then(() => "game"),
    page.waitForURL("**/menu*", { timeout: 10000 }).then(() => "menu"),
  ]);
  if (reachedGame === "menu") {
    await page.goto(`${APP_URL}game`, { waitUntil: "load" });
  }
  await page
    .getByRole("button", { name: /Leaderboard/i })
    .first()
    .waitFor({ state: "visible", timeout: 12000 });
}

function parseHandId(line: string): string | null {
  const equalsMatch = line.match(/handId=([^\s]+)/);
  if (equalsMatch) return equalsMatch[1];
  const colonMatch = line.match(/handId:\s*'([^']+)'/);
  return colonMatch ? colonMatch[1] : null;
}

function parseStreet(line: string): string | null {
  const match = line.match(/street=([a-zA-Z]+)/);
  return match ? match[1].toLowerCase() : null;
}

function parseStreetRound(line: string): number | null {
  const match = line.match(/streetRound=(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseMetadata(line: string) {
  const idx = line.indexOf("metadata=");
  if (idx === -1) return null;
  const jsonText = line.slice(idx + "metadata=".length);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function extractCards(line: string, key: "before" | "after"): string[] {
  const metadata = parseMetadata(line);
  const arr = metadata?.drawInfo?.[key];
  return Array.isArray(arr) ? [...arr] : [];
}

async function getLastPotSummary(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getLastPotSummary?.() ?? []);
}

async function waitForPotSummary(page: Page, minLength = 1, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const summary = await getLastPotSummary(page);
    if (summary.length >= minLength) {
      return summary;
    }
    await page.waitForTimeout(200);
  }
  throw new Error("Timed out waiting for pot summary");
}

async function playHandWithoutFolding(page: Page) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const drawButton = page.getByRole("button", { name: /draw selected/i }).first();
    if (await drawButton.isVisible().catch(() => false)) {
      await drawButton.click().catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }
    const checkButton = page.getByRole("button", { name: /^Check$/i }).first();
    if (await checkButton.isVisible().catch(() => false)) {
      await checkButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    const callButton = page.getByRole("button", { name: /^Call$/i }).first();
    if (await callButton.isVisible().catch(() => false)) {
      await callButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    const raiseButton = page.getByRole("button", { name: /^Raise$/i }).first();
    if (await raiseButton.isVisible().catch(() => false)) {
      await raiseButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.locator("text=Hand Result").first().isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(300);
  }
}

const waitForShowdownLogs = (logs: string[], timeout = 60000, startIndex = 0) =>
  waitForCondition(() => logs.slice(startIndex).some((line) => hasStreet(line, "showdown")), timeout);

const waitForHandEndUI = (page: Page, timeout = 60000) =>
  page.waitForSelector("text=Hand Result", { timeout });

async function waitForHandResolution(
  page: Page,
  logs: string[],
  startIndex = 0,
  timeout = 60000,
) {
  const deadline = Date.now() + timeout;
  const handResultLocator = page.locator("text=Hand Result").first();
  while (Date.now() < deadline) {
    if (logs.slice(startIndex).some((line) => hasStreet(line, "showdown"))) {
      return;
    }
    try {
      if (await handResultLocator.isVisible()) {
        return;
      }
    } catch {
      // locator may not exist yet; ignore errors and continue polling
    }
    await page.waitForTimeout(200);
  }
  throw new Error("Timed out waiting for hand resolution");
}

const lineHasHandId = (line: string, handId: string | null) =>
  Boolean(
    handId &&
      (line.includes(`handId=${handId}`) ||
        line.includes(`handId: '${handId}'`) ||
        line.includes(`handId: ${handId}`)),
  );

const seatRegexCache = new Map<number, RegExp>();
const seatAnyRegexCache = new Map<number, RegExp>();
const PRE_FLOP_ORDER = [3, 4, 5, 0, 1, 2];
const ZERO_INVEST_OVERRIDES = [
  { seat: 3, cards: ["7C", "8D", "9H", "JS"], totalInvested: 0 },
  { seat: 4, cards: ["5C", "6D", "7H", "8S"], totalInvested: 0 },
  { seat: 5, cards: ["9C", "10D", "JH", "QS"], totalInvested: 0 },
];

function seatEqualsRegex(seat: number) {
  if (!seatRegexCache.has(seat)) {
    seatRegexCache.set(seat, new RegExp(`seat=${seat}\\b`));
  }
  return seatRegexCache.get(seat)!;
}

function seatAnyRegex(seat: number) {
  if (!seatAnyRegexCache.has(seat)) {
    seatAnyRegexCache.set(seat, new RegExp(`seat(?:=|:)\\s*${seat}\\b`));
  }
  return seatAnyRegexCache.get(seat)!;
}

function extractWinnerNames(logs: string[], startIndex = 0) {
  const line = logs.slice(startIndex).find((entry) => entry.includes("[SHOWDOWN] Winners:"));
  if (!line) return [];
  const match = line.match(/\[SHOWDOWN\] Winners:\s*\[(.*)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((segment) => segment.replace(/[\[\]'"]/g, "").trim())
    .filter((token) => token.length > 0);
}

async function waitForWinnersLog(logs: string[], startIndex = 0, timeout = 60000) {
  await waitForCondition(() => extractWinnerNames(logs, startIndex).length > 0, timeout);
  return extractWinnerNames(logs, startIndex);
}

function firstActiveBetSeat(
  players: Array<Record<string, unknown>> | undefined,
  dealerIdx: number,
  fallback = 0,
) {
  if (!Array.isArray(players) || players.length === 0) {
    return fallback;
  }
  const n = players.length;
  const start = ((dealerIdx + 3) % n + n) % n;
  for (let offset = 0; offset < n; offset += 1) {
    const seat = (start + offset) % n;
    const player = players[seat] ?? {};
    const seatOut = Boolean(player.seatOut);
    const folded = Boolean(player.folded ?? player.hasFolded);
    const busted = Number(player.stack ?? 0) <= 0;
    const allIn = Boolean(player.allIn);
    if (!seatOut && !folded && !busted && !allIn) {
      return seat;
    }
  }
  return start;
}

function getSeatActionLines(logs: string[], handId: string | null, seat: number) {
  const seatPattern = seatEqualsRegex(seat);
  return logs.filter(
    (line) =>
      line.includes("[E2E-ACTION]") &&
      (!handId || lineHasHandId(line, handId)) &&
      seatPattern.test(line),
  );
}

function getSeatEventLines(logs: string[], handId: string | null, seat: number, tag: string) {
  const seatPattern = seatAnyRegex(seat);
  return logs.filter(
    (line) =>
      line.includes(`[E2E-${tag}]`) &&
      (!handId || lineHasHandId(line, handId)) &&
      seatPattern.test(line),
  );
}

function findHandId(lines: string[]): string | null {
  for (const line of lines) {
    const handId = parseHandId(line);
    if (handId) return handId;
  }
  return null;
}

function computeExpectedWinners(players: Array<Record<string, any>>) {
  if (!Array.isArray(players) || players.length === 0) return [];
  const eligible = players
    .map((player, idx) => ({
      seat: idx,
      seatIndex: idx,
      name: player?.name ?? `Seat ${idx}`,
      hand: player?.hand ?? [],
      seatOut: player?.seatOut,
      folded: player?.folded,
    }))
    .filter((entry) => !entry.seatOut && !entry.folded && Array.isArray(entry.hand) && entry.hand.length);
  if (!eligible.length) return [];
  return getWinnersByBadugi(eligible).map((winner) => winner.name);
}

async function waitForE2EDriver(page: Page) {
  const REQUIRED_METHODS = [
    "forceSeatAction",
    "forceSequentialFolds",
    "forceAllIn",
    "resolveHandNow",
    "dealNewHandNow",
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

async function waitForHandsApplied(
  page: Page,
  overrides: Array<{ seat: number; cards: string[] }>,
) {
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

async function waitForSeatActionLog(
  logs: string[],
  seat: number,
  startIndex: number,
  matcher: (line: string) => boolean = () => true,
) {
  await waitForCondition(
    () =>
      logs
        .slice(startIndex)
        .some(
          (line) =>
            line.includes("[E2E-ACTION]") &&
            seatEqualsRegex(seat).test(line) &&
            matcher(line),
        ),
    30000,
  ).catch((error) => {
    throw new Error(`Timed out waiting for seat ${seat} action log: ${error?.message ?? error}`);
  });
}

async function waitForHandResultPots(page: Page) {
  await page.waitForSelector('[data-testid="hand-result-pot"]:visible', { timeout: 20000 });
  return page.locator('[data-testid="hand-result-pot"]:visible');
}

async function getHandHistoryRecords(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getHandHistory?.() ?? []);
}

test.describe("Badugi flow regressions", () => {
  test("Hero fold is terminal within the same hand", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;

    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });
    await foldButton.click();
    await Promise.all([waitForHandEndUI(page, 45000), waitForShowdownLogs(logs, 45000)]);

    const heroFoldAction = logs.find(
      (line) => line.includes("[E2E-ACTION]") && line.includes("action=Fold") && /seat=0\b/.test(line),
    );
    expect(heroFoldAction).toBeTruthy();
    if (!heroFoldAction) {
      throw new Error("hero fold action log not found");
    }
    const handId = parseHandId(heroFoldAction);
    expect(handId).toBeTruthy();
    if (!handId) {
      throw new Error("hero fold action missing handId");
    }
    const foldEvents = logs.filter(
      (line) => line.includes("[E2E-EVENT] FOLD") && lineHasHandId(line, handId) && /turn:\s*0\b/.test(line),
    );
    expect(foldEvents).toHaveLength(1);
    const foldIndex = logs.indexOf(heroFoldAction);
    const laterHeroActions = logs.filter(
      (line, idx) =>
        idx > foldIndex &&
        line.includes("[E2E-ACTION]") &&
        line.includes(`handId=${handId}`) &&
        /seat=0\b/.test(line),
    );
    expect(laterHeroActions).toHaveLength(0);

    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const secondHandActionIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await waitForSeatActionLog(logs, 0, secondHandActionIdx);
    const heroSecondAction = logs
      .slice(secondHandActionIdx)
      .find((line) => line.includes("[E2E-ACTION]") && /seat=0\b/.test(line));
    expect(heroSecondAction).toBeTruthy();
    const secondHandId = heroSecondAction ? parseHandId(heroSecondAction) : null;
    expect(secondHandId && secondHandId !== handId).toBe(true);
  });

  test("UTG (or next alive) acts first in a fresh betting round", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    await invokeE2E(page, "resolveHandNow");
    await waitForHandEndUI(page, 60000);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });
    logs.length = 0;
    const phaseState = await page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
    expect(phaseState).toBeTruthy();
    const utgSeat = firstActiveBetSeat(phaseState?.players, phaseState?.dealerIdx ?? 0);
    await invokeE2E(page, "forceSeatAction", utgSeat, { type: "check" });
    await waitForSeatActionLog(logs, utgSeat, 0, (line) => hasStreet(line, "bet"));
    const firstActionLine = logs.find((line) => line.includes("[E2E-ACTION]"));
    expect(firstActionLine).toBeTruthy();
    if (!firstActionLine) {
      throw new Error("Missing BET action log for UTG seat");
    }
    expect(seatEqualsRegex(utgSeat).test(firstActionLine)).toBe(true);
    expect(parseStreet(firstActionLine)).toBe("bet");
    expect(parseStreetRound(firstActionLine)).toBe(0);
  });

  test("Full 3-draw flow keeps card history intact", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    logs.length = 0;

    await playHandWithoutFolding(page);
    await Promise.all([waitForHandEndUI(page, 70000), waitForShowdownLogs(logs, 70000)]);

    const drawActions = logs.filter((line) => line.includes("[E2E-ACTION]") && hasStreet(line, "draw"));
    const uniqueDrawRounds = Array.from(
      new Set(
        drawActions
          .map((line) => parseStreetRound(line))
          .filter((value): value is number => typeof value === "number"),
      ),
    ).sort((a, b) => a - b);
    expect(uniqueDrawRounds).toEqual([1, 2, 3]);

    const heroDrawLogs = logs.filter((line) => line.includes("[E2E-DRAW]") && line.includes("seat=0"));
    expect(heroDrawLogs.length).toBeGreaterThanOrEqual(3);
    let previousAfter: string[] | null = null;
    for (const line of heroDrawLogs) {
      const before = extractCards(line, "before");
      const after = extractCards(line, "after");
      if (previousAfter) {
        expect(before).toEqual(previousAfter);
      }
      previousAfter = after;
    }

    const stageSequence: string[] = [];
    for (const line of logs) {
      if (!line.includes("[E2E-ACTION]")) continue;
      const street = parseStreet(line);
      if (!street) continue;
      if (stageSequence[stageSequence.length - 1] !== street) {
        stageSequence.push(street);
      }
    }
    expect(stageSequence.slice(0, 8)).toEqual(["bet", "draw", "bet", "draw", "bet", "draw", "bet", "showdown"]);
  });

  test("No-next-alive scenarios never emit seat=-1 skips", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    logs.length = 0;

    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });
    await foldButton.click();
    await waitForHandResolution(page, logs);

    const invalidSkips = logs.filter((line) => line.includes("seat=-1"));
    expect(invalidSkips).toHaveLength(0);
  });

  test("Position-specific folds keep action order intact", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;

    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });

    const handsToPlay = 2;
    for (let handIdx = 0; handIdx < handsToPlay; handIdx += 1) {
      const startIdx = logs.length;
      await invokeE2E(page, "forceSeatAction", 0, { type: "fold" });
      await waitForSeatActionLog(logs, 0, startIdx, (line) => line.includes("action=Fold"));
      await invokeE2E(page, "resolveHandNow");
      await waitForHandResolution(page, logs, startIdx);

      const handLogs = logs.slice(startIdx);
      const heroFoldAction = handLogs.find(
        (line) => line.includes("[E2E-ACTION]") && /seat=0\b/.test(line) && line.includes("action=Fold"),
      );
      expect(heroFoldAction).toBeTruthy();
      if (!heroFoldAction) {
        throw new Error("Missing hero fold action in log");
      }
      const handId = parseHandId(heroFoldAction);
      expect(handId).toBeTruthy();
      if (!handId) {
        throw new Error("Hero fold line missing handId");
      }

      const foldEvents = getSeatEventLines(handLogs, handId, 0, "EVENT");
      expect(foldEvents).toHaveLength(1);

      const heroActions = getSeatActionLines(handLogs, handId, 0);
      const nonFoldActions = heroActions.filter(
        (line) => !line.includes("action=Fold") && !line.includes("action=Collect"),
      );
      expect(nonFoldActions).toHaveLength(0);

      if (handIdx < handsToPlay - 1) {
        await invokeE2E(page, "dealNewHandNow");
        await foldButton.waitFor({ state: "visible", timeout: 30000 });
      }
    }
  });

  test("Sequential CPU folds transition cleanly to heads-up", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;

    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });

    const heroActionIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await waitForSeatActionLog(logs, 0, heroActionIdx);

    const cpuSeats = [1, 2, 3, 4];
    const startIdx = logs.length;
    await invokeE2E(page, "forceSequentialFolds", cpuSeats);
    await Promise.all(
      cpuSeats.map((seat) =>
        waitForSeatActionLog(logs, seat, startIdx, (line) => line.includes("action=Fold")),
      ),
    );
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);

    const handLogs = logs.slice(startIdx);
    const sampleHandId = findHandId(handLogs);
    expect(sampleHandId).toBeTruthy();
    if (!sampleHandId) {
      throw new Error("Unable to determine handId for sequential folds test");
    }

    for (const seat of cpuSeats) {
      const seatActionLines = getSeatActionLines(handLogs, sampleHandId, seat);
      const hasFold = seatActionLines.some((line) => line.includes("action=Fold"));
      expect(hasFold).toBeTruthy();
      const unexpected = seatActionLines.filter(
        (line) => !line.includes("action=Fold") && !line.includes("action=Collect"),
      );
      expect(unexpected).toHaveLength(0);
      const skipLines = handLogs.filter(
        (line) => line.includes("[E2E-SKIP]") && seatAnyRegex(seat).test(line),
      );
      expect(skipLines).toHaveLength(0);
    }

  });

  test("All-in / bust-out flow guards against extra actions", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;

    const targetSeat = 1;
    const heroIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await waitForSeatActionLog(logs, 0, heroIdx);
    const startIdx = logs.length;
    await invokeE2E(page, "forceAllIn", targetSeat);
    await waitForSeatActionLog(logs, targetSeat, startIdx, (line) => line.includes("All-in"));
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);

    const handLogs = logs.slice(startIdx);
    const handId = findHandId(handLogs);
    expect(handId).toBeTruthy();
    if (!handId) {
      throw new Error("Unable to determine handId for all-in test");
    }

    const seatActionLines = getSeatActionLines(handLogs, handId, targetSeat);
    const allInIndex = seatActionLines.findIndex((line) => line.includes("action=All-in"));
    expect(allInIndex).toBeGreaterThanOrEqual(0);
    const postAllIn = seatActionLines.slice(allInIndex + 1).filter(
      (line) => !line.includes("action=Collect"),
    );
    expect(postAllIn).toHaveLength(0);
    const skipLines = handLogs.filter(
      (line) => line.includes("[E2E-SKIP]") && seatAnyRegex(targetSeat).test(line),
    );
    expect(skipLines).toHaveLength(0);
  });

  test("Consecutive hands reset hero state and folded flags", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;

    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });

    const handsToPlay = 3;
    const seenHandIds = new Set<string>();

    for (let handIdx = 0; handIdx < handsToPlay; handIdx += 1) {
      const startIdx = logs.length;
      await invokeE2E(page, "forceSeatAction", 0, { type: "fold" });
      await waitForSeatActionLog(logs, 0, startIdx, (line) => line.includes("action=Fold"));
      await invokeE2E(page, "resolveHandNow");
      await waitForHandResolution(page, logs, startIdx);

      const handLogs = logs.slice(startIdx);
      const heroFoldAction = handLogs.find(
        (line) => line.includes("[E2E-ACTION]") && /seat=0\b/.test(line) && line.includes("action=Fold"),
      );
      expect(heroFoldAction).toBeTruthy();
      if (!heroFoldAction) {
        throw new Error("Hero fold action missing in multi-hand test");
      }
      const handId = parseHandId(heroFoldAction);
      expect(handId).toBeTruthy();
      if (!handId) {
        throw new Error("Hero fold log missing handId in multi-hand test");
      }
      seenHandIds.add(handId);

      const heroActions = getSeatActionLines(handLogs, handId, 0);
      const nonFold = heroActions.filter(
        (line) => !line.includes("action=Fold") && !line.includes("action=Collect"),
      );
      expect(nonFold).toHaveLength(0);

      const foldEvents = getSeatEventLines(handLogs, handId, 0, "EVENT");
      expect(foldEvents).toHaveLength(1);

    if (handIdx < handsToPlay - 1) {
      await invokeE2E(page, "dealNewHandNow");
      await foldButton.waitFor({ state: "visible", timeout: 30000 });
    }
  }

  expect(seenHandIds.size).toBe(handsToPlay);
});

  test("Folded seats never appear among showdown winners", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    const foldButton = page.getByRole("button", { name: /^Fold$/i }).first();
    await foldButton.waitFor({ state: "visible", timeout: 30000 });
    const startIdx = logs.length;
    const foldedSeats = [1, 2];
    await invokeE2E(page, "forceSequentialFolds", foldedSeats);
    await Promise.all(
      foldedSeats.map((seat) =>
        waitForSeatActionLog(logs, seat, startIdx, (line) => line.includes("action=Fold")),
      ),
    );
    const heroStartIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await waitForSeatActionLog(logs, 0, heroStartIdx);
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const winners = await waitForWinnersLog(logs, startIdx);
    ["CPU 2", "CPU 3"].forEach((name) => expect(winners).not.toContain(name));
  });

  test("Showdown logs every tied winner", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const startIdx = logs.length;
    const tieHandHero = ["AC", "2D", "3H", "4S"];
    const tieHandCpu = ["AS", "2C", "3D", "4H"];
    expect(compareBadugi(tieHandHero, tieHandCpu)).toBe(0);
    await waitForE2EHelper(page, "setPlayerHands");
    const tieOverrides = [
      { seat: 0, cards: tieHandHero, totalInvested: 200 },
      { seat: 1, cards: ["8C", "9D", "10H", "QS"], totalInvested: 0 },
      { seat: 2, cards: tieHandCpu, totalInvested: 200 },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await invokeE2E(page, "setPlayerHands", tieOverrides);
    await waitForHandsApplied(page, tieOverrides);
    await invokeE2E(page, "forceSequentialFolds", [1, 3, 4, 5]);
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await invokeE2E(page, "forceSeatAction", 2, { type: "check" });
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const winners = await waitForWinnersLog(logs, startIdx);
    expect(new Set(winners)).toEqual(new Set(["You", "CPU 3"]));
    const potSections = await waitForHandResultPots(page);
    await expect(potSections).toHaveCount(1);
    const winnerRows = potSections.first().locator('[data-testid="hand-result-winner-row"]');
    await expect(winnerRows).toHaveCount(2);
    await expect(
      winnerRows.first().locator('[data-testid="hand-result-winner-hand-label"]'),
    ).toHaveText(/Badugi 4-card/i);
    const ranksText = await winnerRows
      .first()
      .locator('[data-testid="hand-result-winner-ranks"]')
      .innerText();
    expect(ranksText).toBe("A-2-3-4");
  });

  test("Four-card Badugi beats any three-card hand at showdown", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const startIdx = logs.length;
    const fourCard = ["2C", "4D", "6H", "8S"];
    const threeCard = ["AC", "2C", "3D", "4H"];
    expect(compareBadugi(fourCard, threeCard)).toBeLessThan(0);
    await waitForE2EHelper(page, "setPlayerHands");
    const fourVsThreeOverrides = [
      { seat: 0, cards: fourCard, totalInvested: 200 },
      { seat: 1, cards: threeCard, totalInvested: 200 },
      { seat: 2, cards: ["KD", "QD", "JS", "10H"], totalInvested: 200 },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await invokeE2E(page, "setPlayerHands", fourVsThreeOverrides);
    await waitForHandsApplied(page, fourVsThreeOverrides);
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await invokeE2E(page, "forceSeatAction", 1, { type: "check" });
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const winners = await waitForWinnersLog(logs, startIdx);
    const winnerSet = new Set(winners);
    expect(winnerSet.has("You")).toBe(true);
    expect(winnerSet.has("CPU 2")).toBe(false);
    const potSections = await waitForHandResultPots(page);
    const potCount = await potSections.count();
    expect(potCount).toBeGreaterThanOrEqual(1);
    const potTitles = await potSections
      .locator('[data-testid="hand-result-pot-title"]')
      .allTextContents();
    expect(potTitles[0]).toMatch(/pot/i);
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

  test("UI shows single pot summary when no player is all-in", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    await waitForE2EHelper(page, "setPlayerHands");
    const singlePotOverrides = [
      { seat: 0, cards: ["AC", "2D", "3H", "4S"], totalInvested: 120 },
      { seat: 1, cards: ["5C", "6D", "7H", "8S"], totalInvested: 120 },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await invokeE2E(page, "setPlayerHands", singlePotOverrides);
    await waitForHandsApplied(page, singlePotOverrides);
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await invokeE2E(page, "forceSeatAction", 1, { type: "check" });
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, 0);
    const potSections = await waitForHandResultPots(page);
    const potCount = await potSections.count();
    expect(potCount).toBeGreaterThanOrEqual(1);
    await expect(
      potSections.first().locator('[data-testid="hand-result-pot-title"]'),
    ).toHaveText(/pot/i);
  });

  test("Side-pot summary appears only when an all-in is covered by deeper stacks", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const sideOverrides = [
      { seat: 0, cards: ["AC", "2D", "3H", "4S"], totalInvested: 100, stack: 0, allIn: true },
      { seat: 1, cards: ["5C", "6D", "7H", "8S"], totalInvested: 300, stack: 0, allIn: true },
      { seat: 2, cards: ["9C", "10D", "JH", "QS"], totalInvested: 300, stack: 0, allIn: true },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await waitForE2EHelper(page, "setPlayerHands");
    await invokeE2E(page, "setPlayerHands", sideOverrides);
    await waitForHandsApplied(page, sideOverrides);
    const foldedSideSeats = [3, 4, 5];
    const foldStartIdx = logs.length;
    await invokeE2E(page, "forceSequentialFolds", foldedSideSeats);
    await Promise.all(
      foldedSideSeats.map((seat) =>
        waitForSeatActionLog(logs, seat, foldStartIdx, (line) => line.includes("action=Fold")),
      ),
    );
    const startIdx = logs.length;
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const summary = await waitForPotSummary(page, 1);
    expect(summary.length).toBeGreaterThanOrEqual(2);
    const mainPot = summary[0];
    const sidePot = summary[1];
    expect(mainPot.amount).toBeGreaterThan(0);
    expect(sidePot.amount).toBeGreaterThan(0);
    expect(mainPot.eligible.includes(0)).toBe(true);
    const heroFreeSidePot = summary.find(
      (pot: any, idx: number) => idx > 0 && Array.isArray(pot.eligible) && !pot.eligible.includes(0),
    );
    expect(heroFreeSidePot).toBeTruthy();
    const potSections = await waitForHandResultPots(page);
    const potCount = await potSections.count();
    expect(potCount).toBeGreaterThanOrEqual(2);
    await expect(
      potSections.nth(0).locator('[data-testid="hand-result-pot-title"]'),
    ).toHaveText("Main Pot");
    await expect(
      potSections.nth(1).locator('[data-testid="hand-result-pot-title"]'),
    ).toHaveText("Side Pot #2");
    const sideWinnerNames = await potSections
      .nth(1)
      .locator('[data-testid="hand-result-winner-name"]')
      .allTextContents();
    expect(sideWinnerNames).not.toContain("You");
  });

  test("Hand history captures single-pot showdown metadata", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    const historyBefore = await getHandHistoryRecords(page);
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const heroHand = ["2C", "4D", "6H", "8S"];
    const villainHand = ["AC", "2C", "3D", "4H"];
    await waitForE2EHelper(page, "setPlayerHands");
    const overrides = [
      { seat: 0, cards: heroHand, totalInvested: 200 },
      { seat: 1, cards: villainHand, totalInvested: 200 },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await invokeE2E(page, "setPlayerHands", overrides);
    await waitForHandsApplied(page, overrides);
    const foldedHistorySeats = [2, 3, 4, 5];
    const foldStartIdx = logs.length;
    await invokeE2E(page, "forceSequentialFolds", foldedHistorySeats);
    await Promise.all(
      foldedHistorySeats.map((seat) =>
        waitForSeatActionLog(logs, seat, foldStartIdx, (line) => line.includes("action=Fold")),
      ),
    );
    const startIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await waitForSeatActionLog(logs, 0, startIdx, (line) => line.includes("action=Check"));
    await invokeE2E(page, "forceSeatAction", 1, { type: "check" });
    await waitForSeatActionLog(logs, 1, startIdx, (line) => line.includes("action=Check"));
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const history = await getHandHistoryRecords(page);
    expect(history.length).toBe(historyBefore.length + 1);
    const record = history[history.length - 1];
    expect(record.pots.length).toBe(1);
    expect(record.pots[0].winners[0].seat).toBe(0);
    const heroSeat = record.seats.find((seat) => seat.seat === 0);
    expect(heroSeat.hand).toEqual(heroHand);
    const expectedEval = evaluateBadugi(heroHand);
    expect(heroSeat.evaluation).toEqual(expectedEval);
  });

  test("Hand history records side-pot breakdown", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    const historyBefore = await getHandHistoryRecords(page);
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const sideOverrides = [
      { seat: 0, cards: ["AC", "2D", "3H", "4S"], totalInvested: 100 },
      { seat: 1, cards: ["5C", "6D", "7H", "8S"], totalInvested: 300 },
      { seat: 2, cards: ["9C", "10D", "JH", "QS"], totalInvested: 300 },
      ...ZERO_INVEST_OVERRIDES,
    ];
    await waitForE2EHelper(page, "setPlayerHands");
    await invokeE2E(page, "setPlayerHands", sideOverrides);
    await waitForHandsApplied(page, sideOverrides);
    await invokeE2E(page, "forceSequentialFolds", [3, 4, 5]);
    const startIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "check" });
    await invokeE2E(page, "forceSeatAction", 1, { type: "check" });
    await invokeE2E(page, "forceSeatAction", 2, { type: "check" });
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const history = await getHandHistoryRecords(page);
    expect(history.length).toBe(historyBefore.length + 1);
    const record = history[history.length - 1];
    expect(record.pots.length).toBeGreaterThanOrEqual(2);
    expect(record.pots[0].eligibleSeats).toEqual([0, 1, 2]);
    expect(record.pots[1].eligibleSeats).toEqual([1, 2]);
  });

  test("Hand history marks fold-only winners", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
    await waitForE2EDriver(page);
    logs.length = 0;
    const historyBefore = await getHandHistoryRecords(page);
    await invokeE2E(page, "dealNewHandNow");
    await page.getByRole("button", { name: /^Fold$/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const startIdx = logs.length;
    await invokeE2E(page, "forceSeatAction", 0, { type: "fold" });
    await waitForSeatActionLog(logs, 0, startIdx, (line) => line.includes("action=Fold"));
    const foldedSeats = [1, 2, 3, 4];
    await invokeE2E(page, "forceSequentialFolds", foldedSeats);
    await Promise.all(
      foldedSeats.map((seat) =>
        waitForSeatActionLog(logs, seat, startIdx, (line) => line.includes("action=Fold")),
      ),
    );
    await invokeE2E(page, "resolveHandNow");
    await waitForHandResolution(page, logs, startIdx);
    const history = await getHandHistoryRecords(page);
    expect(history.length).toBe(historyBefore.length + 1);
    const record = history[history.length - 1];
    const heroSeat = record.seats.find((seat) => seat.seat === 0);
    expect(heroSeat.finalAction).toBe("fold");
    const winnerSeat = record.seats.find((seat) => seat.seat === 5);
    expect(winnerSeat.finalAction === "win" || winnerSeat.finalAction === "showdown").toBe(true);
  });
});
