import { expect, Page, test } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  invokeE2E,
  performSafeAction,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";

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

async function openGame(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page);
  await waitForE2EDriver(page);
}

async function waitForLog(logs: string[], matcher: (line: string) => boolean, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const line = logs.find(matcher);
    if (line) return line;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for Badugi E2E log");
}

function parseHandId(line: string) {
  return line.match(/handId=([^\s]+)/)?.[1] ?? null;
}

async function dealNewHand(page: Page) {
  await invokeE2E(page, "dealNewHandNow");
  await page.waitForTimeout(250);
}

async function reachBetActor(page: Page, seat: number, maxSteps = 160) {
  for (let step = 0; step < maxSteps; step += 1) {
    const progress = await getProgressState(page);
    if (progress?.phase === "BET" && progress?.actor === seat) {
      return progress;
    }

    if (progress?.isTerminal) {
      await dealNewHand(page);
      continue;
    }

    const key = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(
      acted.acted,
      `setup should reach seat ${seat} as a legal BET actor: ${JSON.stringify({
        step,
        progress: summarizeProgressState(progress),
        acted,
      })}`,
    ).toBe(true);
    await waitForProgressChange(page, key, { timeout: 15000 }).catch(() => page.waitForTimeout(250));
  }

  throw new Error(`Timed out reaching seat ${seat} as BET actor`);
}

async function forceFoldCurrentSeat(page: Page, logs: string[], seat: number) {
  const before = await getProgressState(page);
  expect(before?.phase).toBe("BET");
  expect(before?.actor).toBe(seat);
  const startIndex = logs.length;
  const beforeKey = progressKey(before);
  if (seat === 0) {
    await page.getByTestId("action-fold").first().click();
  } else {
    const outcome =
      (await invokeE2E(page, "forceControllerAction", seat, { type: "fold" })) ??
      (await invokeE2E(page, "forceSeatAction", seat, { type: "fold" }));
    expect(outcome?.rejected, `forced fold should apply for seat ${seat}: ${JSON.stringify(outcome)}`).not.toBe(true);
    expect(outcome, `forced fold should apply for seat ${seat}`).toBeTruthy();
  }
  await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => page.waitForTimeout(250));
  const event = await waitForLog(
    logs,
    (line) =>
      logs.indexOf(line) >= startIndex &&
      line.includes("[E2E-EVENT] FOLD") &&
      new RegExp(`seat=${seat}\\b`).test(line) &&
      line.includes("hasFolded=true"),
  );
  await waitForLog(
    logs,
    (line) =>
      logs.indexOf(line) >= startIndex &&
      line.includes("[E2E-ACTION]") &&
      new RegExp(`seat=${seat}\\b`).test(line) &&
      line.includes("action=Fold"),
    1500,
  ).catch(() => null);
  return event;
}

test.describe("Badugi fold event logging regression", () => {
  test.describe.configure({ timeout: 120000 });

  test("hero fold events include seat and handId", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);

    await reachBetActor(page, 0);
    const action = await forceFoldCurrentSeat(page, logs, 0);
    const handId = parseHandId(action);
    expect(handId).toBeTruthy();
    const event = await waitForLog(
      logs,
      (line) => line.includes("[E2E-EVENT] FOLD") && /seat=0\b/.test(line) && line.includes(`handId=${handId}`),
    );
    expect(event).toContain("hasFolded=true");
  });

  test("position-specific forced folds are logged for the current hand only", async ({ page }) => {
    const logs = setupE2ELogCapture(page);
    await openGame(page);

    await reachBetActor(page, 1);
    const seatOne = await forceFoldCurrentSeat(page, logs, 1);
    const handId = parseHandId(seatOne);
    expect(handId).toBeTruthy();
    await waitForLog(
      logs,
      (line) => line.includes("[E2E-EVENT] FOLD") && /seat=1\b/.test(line) && line.includes(`handId=${handId}`),
    );
    await reachBetActor(page, 2);
    const seatTwo = await forceFoldCurrentSeat(page, logs, 2);
    expect(parseHandId(seatTwo)).toBe(handId);
    await waitForLog(
      logs,
      (line) => line.includes("[E2E-EVENT] FOLD") && /seat=2\b/.test(line) && line.includes(`handId=${handId}`),
    );

    await invokeE2E(page, "resolveHandNow");
    await dealNewHand(page);
    const afterNewHandIndex = logs.length;
    await reachBetActor(page, 0);
    const progress = await getProgressState(page);
    const key = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(acted.acted, "hero should act in the new hand").toBe(true);
    await waitForProgressChange(page, key, { timeout: 15000 }).catch(() => page.waitForTimeout(250));
    const newHandAction = await waitForLog(
      logs,
      (line) =>
        logs.indexOf(line) >= afterNewHandIndex &&
        line.includes("[E2E-ACTION]") &&
        /seat=0\b/.test(line),
    );
    expect(parseHandId(newHandAction)).not.toBe(handId);
  });
});
