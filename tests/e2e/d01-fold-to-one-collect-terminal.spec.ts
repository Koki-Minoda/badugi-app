import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getLegalActions,
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
const TRACE_PATH = path.join(REPORT_DIR, "d01-fold-to-one-terminal-trace.jsonl");
const SUMMARY_PATH = path.join(REPORT_DIR, "d01-fold-to-one-terminal-summary.json");

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function writeJson(filePath: string, payload: any) {
  ensureDirs();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTrace(rows: any[]) {
  ensureDirs();
  fs.writeFileSync(TRACE_PATH, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

async function collect(page: Page, label: string, trace: any[]) {
  await page.waitForTimeout(50);
  const row = await page.evaluate(
    ({ label }) => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label, mode: "cash", action: null }),
    { label },
  );
  const assertion = assertBrowserGameplayInvariants(row, trace);
  const enriched = { ...row, label, expected: assertion.expected, violations: assertion.violations };
  trace.push(enriched);
  return enriched;
}

async function openD01(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=D01`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

async function applyCurrentAction(page: Page, progress: any) {
  const actor = progress?.actor;
  if (typeof actor !== "number") return { acted: false, action: "no-actor" };
  const beforeKey = progressKey(progress);
  const action =
    actor === 0
      ? progress.currentBet > Number(progress.players?.[0]?.bet ?? 0)
        ? { type: "CALL", amount: Math.max(0, progress.currentBet - Number(progress.players?.[0]?.bet ?? 0)) }
        : { type: "CHECK" }
      : { type: "FOLD" };

  if (actor === 0) {
    const legal = await getLegalActions(page);
    const testId = action.type === "CALL" ? "action-call" : "action-check";
    if (legal.includes(testId)) {
      await page.getByTestId(testId).first().click();
    } else {
      await invokeE2E(page, "forceControllerAction", actor, action);
    }
  } else {
    await invokeE2E(page, "forceControllerAction", actor, action);
  }
  await waitForProgressChange(page, beforeKey, { timeout: 10000 }).catch(() => {});
  return { acted: true, actor, action };
}

test("D01 fold-to-one collect reaches terminal and hides stale controls", async ({ page }) => {
  const trace: any[] = [];
  await openD01(page);
  await collect(page, "initial", trace);

  let terminal: any = null;
  for (let step = 0; step < 40; step += 1) {
    const progress = await getProgressState(page);
    if (progress?.isTerminal) {
      terminal = progress;
      await collect(page, `terminal-${step}`, trace);
      break;
    }
    const applied = await applyCurrentAction(page, progress);
    await collect(page, `step-${step}-${applied.action?.type ?? applied.action}`, trace);
  }

  writeTrace(trace);
  const latest = await getProgressState(page);
  const activeSeats = (latest.players ?? [])
    .map((player: any, seat: number) => ({ player, seat }))
    .filter(({ player }) => !player.folded && !player.seatOut && !player.allIn)
    .map(({ seat }) => seat);
  const heroControls = latest.ui?.actions ?? [];
  const summary = {
    status: latest.isTerminal && heroControls.length === 0 ? "PASS" : "FAIL",
    terminalReached: Boolean(latest.isTerminal || terminal),
    activeSeats,
    latest: summarizeProgressState(latest),
    heroControls,
    tracePath: TRACE_PATH,
  };
  writeJson(SUMMARY_PATH, summary);

  if (summary.status !== "PASS") {
    ensureDirs();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "d01-fold-to-one-terminal-failure.png"),
      fullPage: true,
    });
  }

  expect(summary.terminalReached, JSON.stringify(summary, null, 2)).toBe(true);
  expect(heroControls, JSON.stringify(summary, null, 2)).toEqual([]);
  expect(activeSeats, JSON.stringify(summary, null, 2)).toEqual([0]);
});
