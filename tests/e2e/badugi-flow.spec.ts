import { test, expect, Page } from "@playwright/test";

const APP_URL = "http://127.0.0.1:3000/";

const hasStreet = (line: string, street: string) =>
  line.toLowerCase().includes(`street=${street.toLowerCase()}`);

function setupE2ELogCapture(page: Page) {
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[E2E-")) {
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

test.describe("Badugi flow regressions", () => {
  test("Hero fold is terminal within the same hand", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);
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
    await waitForCondition(
      () =>
        cpuSeats.every((seat) =>
          logs
            .slice(startIdx)
            .some(
              (line) =>
                line.includes("[E2E-ACTION]") &&
                seatEqualsRegex(seat).test(line) &&
                line.includes("action=Fold"),
            ),
        ),
      30000,
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
});
