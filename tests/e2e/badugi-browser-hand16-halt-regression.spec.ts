import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
  getProgressDecisionSnapshot,
  getProgressState,
  invokeE2E,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import { assertBrowserGameplayInvariants } from "../../src/ui/qa/assertBrowserGameplayInvariants.js";

const REPORT_DIR = path.resolve("reports/browser-gameplay");
const SCREENSHOT_DIR = path.resolve("reports/screenshots");
const TRACE_PATH = path.join(REPORT_DIR, "badugi-cash-desktop-hand16-halt-trace.jsonl");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-cash-desktop-hand16-halt-summary.json");
const DECISION_LOG_PATH = path.join(REPORT_DIR, "progress-helper-hand16-decision-log.jsonl");
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, "badugi-cash-desktop-hand16-halt.png");

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureDirs();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function appendJsonl(filePath: string, payload: unknown) {
  ensureDirs();
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function playerBet(player: any) {
  return Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0;
}

function choosePayload(progress: any, actionIndex: number) {
  const phase = String(progress?.phase ?? "").toUpperCase();
  const actor = progress?.actor;
  const player = typeof actor === "number" ? progress?.players?.[actor] : null;
  if (phase === "DRAW") {
    const handLength = Array.isArray(player?.hand) ? player.hand.length : 5;
    const discardCount = actionIndex % 5 === 0 ? 0 : Math.min(handLength, (actionIndex % Math.max(1, handLength)) + 1);
    return { type: "draw", discardIndexes: Array.from({ length: discardCount }, (_, index) => index) };
  }
  const toCall = Math.max(0, Number(progress?.currentBet ?? 0) - playerBet(player));
  if (actionIndex % 11 === 0 && toCall === 0) return { type: "raise", amount: 20 };
  if (actionIndex % 17 === 0 && toCall > 0) return { type: "raise", amount: toCall + 20 };
  if (actionIndex % 13 === 0 && actor !== 0 && toCall > 0) return { type: "fold" };
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

async function openBadugiCash(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.evaluate(() => window.__MGX_CLEAR_GAMEPLAY_TRACE__?.());
}

async function collectTrace(page: Page, label: string, mode = "cash") {
  let row: any = null;
  let assertion: ReturnType<typeof assertBrowserGameplayInvariants> | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 100 : 150);
    row = await page.evaluate(
      ({ label: snapshotLabel, mode: snapshotMode }) =>
        window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label: snapshotLabel, mode: snapshotMode }),
      { label, mode },
    );
    if (!row) throw new Error("browser gameplay snapshot API unavailable");
    assertion = assertBrowserGameplayInvariants(row, []);
    if (assertion.violations.length === 0) break;
  }
  const enriched = { ...row, expected: assertion?.expected ?? null, violations: assertion?.violations ?? [] };
  appendJsonl(TRACE_PATH, enriched);
  return enriched;
}

async function applyPayloadWithDecisionLog(page: Page, hand: number, step: number, actionIndex: number) {
  const progress = await getProgressState(page);
  const decisionBefore = await getProgressDecisionSnapshot(page);
  const payload = choosePayload(progress, actionIndex);
  const logBase = {
    hand,
    step,
    actionIndex,
    progress: decisionBefore,
    nextAttemptedAction: payload,
  };

  if (progress?.isTerminal) {
    appendJsonl(DECISION_LOG_PATH, { ...logBase, decision: "terminal", clickedTarget: null });
    return { acted: false, terminal: true, payload, actor: progress?.actor };
  }

  const actor = progress?.actor;
  if (typeof actor !== "number") {
    appendJsonl(DECISION_LOG_PATH, { ...logBase, decision: "halt", reason: "no actor" });
    return { acted: false, terminal: false, payload, actor };
  }

  const beforeKey = progressKey(progress);
  if (actor === 0) {
    const legal = await getLegalActions(page);
    const preferred =
      payload.type === "raise"
        ? ["action-raise", "action-call", "action-check", "action-fold"]
        : payload.type === "fold"
          ? ["action-fold", "action-call", "action-check"]
          : payload.type === "draw"
            ? ["action-draw-selected"]
            : payload.type === "call"
              ? ["action-call", "action-check", "action-fold"]
              : ["action-check", "action-call", "action-fold"];
    const testId = preferred.find((id) => legal.includes(id));
    appendJsonl(DECISION_LOG_PATH, {
      ...logBase,
      decision: testId ? "click-hero-action" : "no-hero-action-target",
      detectedActionControls: legal,
      clickedTarget: testId ?? null,
    });
    if (testId) {
      await page.getByTestId(testId).first().click();
      return { acted: true, terminal: false, clickedAction: testId, payload, actor };
    }
  }

  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot) {
    snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  }
  if (!snapshot && payload.type === "raise") {
    const fallback = choosePayload(progress, 1);
    snapshot = await invokeE2E(page, "forceControllerAction", actor, fallback);
    if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, fallback);
    let changed = false;
    if (!snapshot) {
      await waitForProgressChange(page, beforeKey, { timeout: 2500 }).catch(() => {});
      const after = await getProgressState(page);
      changed = progressKey(after) !== beforeKey;
    }
    appendJsonl(DECISION_LOG_PATH, {
      ...logBase,
      decision: snapshot ? "controller-fallback-action" : changed ? "auto-progress-after-raise-fallback" : "controller-fallback-rejected",
      clickedTarget: `controller:${fallback.type}`,
      fallback,
    });
    return {
      acted: Boolean(snapshot) || changed,
      terminal: false,
      clickedAction: changed ? "auto-progress-after-raise-fallback" : `controller:${fallback.type}`,
      payload: fallback,
      actor,
    };
  }
  if (!snapshot) {
    await waitForProgressChange(page, beforeKey, { timeout: 2500 }).catch(() => {});
    const after = await getProgressState(page);
    const changed = progressKey(after) !== beforeKey;
    appendJsonl(DECISION_LOG_PATH, {
      ...logBase,
      decision: changed ? "auto-progress" : "halt",
      reason: changed ? null : "controller action rejected and progress did not change",
      after: await getProgressDecisionSnapshot(page),
      clickedTarget: `controller:${payload.type}`,
    });
    return { acted: changed, terminal: false, clickedAction: "auto-progress", payload, actor };
  }
  appendJsonl(DECISION_LOG_PATH, {
    ...logBase,
    decision: "controller-action",
    clickedTarget: `controller:${payload.type}`,
  });
  return { acted: true, terminal: false, clickedAction: `controller:${payload.type}`, payload, actor };
}

async function advanceFromTerminal(page: Page, progress: any, hand: number, step: number) {
  const key = progressKey(progress);
  const nextHand = page.getByRole("button", { name: /next hand/i }).first();
  appendJsonl(DECISION_LOG_PATH, {
    hand,
    step,
    decision: "terminal-next-hand",
    progress: await getProgressDecisionSnapshot(page),
    nextHandVisible: await nextHand.isVisible().catch(() => false),
  });
  if (!(await nextHand.isVisible().catch(() => false))) {
    await waitForProgressChange(page, key, { timeout: 6000 }).catch(() => {});
    return progressKey(await getProgressState(page)) !== key;
  }
  try {
    await nextHand.click({ timeout: 3000 });
  } catch {
    const changed = await waitForProgressChange(page, key, { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (changed) return true;
    await nextHand.click({ force: true, timeout: 3000 }).catch(async () => {
      await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((candidate) =>
          /next hand/i.test(candidate.textContent ?? ""),
        );
        button?.click();
      });
    });
  }
  await waitForProgressChange(page, key, { timeout: 15000 }).catch(() => {});
  return progressKey(await getProgressState(page)) !== key;
}

test.describe("Badugi browser hand16 halt regression", () => {
  test("completes through hand 20 without terminal/action stale halt", async ({ page }) => {
    test.setTimeout(300000);
    ensureDirs();
    for (const filePath of [TRACE_PATH, DECISION_LOG_PATH]) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await openBadugiCash(page);
    let handsCompleted = 0;
    let actionsObserved = 0;
    let halt: any = null;

    await collectTrace(page, "initial");

    for (let hand = 0; hand < 20; hand += 1) {
      for (let step = 0; step < 90; step += 1) {
        const progress = await getProgressState(page);
        if (progress?.isTerminal) {
          handsCompleted += 1;
          await collectTrace(page, `hand-${hand}-terminal`);
          const nextHand = page.getByRole("button", { name: /next hand/i }).first();
          if (hand < 19 && await nextHand.isVisible().catch(() => false)) {
            await advanceFromTerminal(page, progress, hand, step);
          }
          break;
        }

        const beforeKey = progressKey(progress);
        const acted = await applyPayloadWithDecisionLog(page, hand, step, actionsObserved + 1);
        if (acted.terminal) {
          continue;
        }
        if (!acted.acted) {
          halt = {
            hand,
            step,
            lastProgress: summarizeProgressState(progress),
            nextAttemptedAction: acted.payload,
            reason: "action application failed",
          };
          await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
          break;
        }
        actionsObserved += 1;
        await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => {});
        await collectTrace(page, `hand-${hand}-step-${step}`);
      }
      if (halt) break;
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      status: halt ? "FAIL" : "PASS",
      handsCompleted,
      actionsObserved,
      halt,
      tracePath: TRACE_PATH,
      decisionLogPath: DECISION_LOG_PATH,
      screenshotPath: halt ? SCREENSHOT_PATH : null,
    };
    writeJson(SUMMARY_PATH, summary);
    expect(halt, JSON.stringify(summary, null, 2)).toBeNull();
    expect(handsCompleted).toBeGreaterThanOrEqual(20);
  });
});
