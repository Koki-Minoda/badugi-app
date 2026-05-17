import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { CORE5_VARIANTS } from "./helpers/core5LayoutAuditHelper";
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
const SUMMARY_PATH = path.join(REPORT_DIR, "browser-gameplay-invariant-summary.json");
const FAILURE_PATH = path.join(REPORT_DIR, "browser-gameplay-invariant-failures.json");

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
} as const;

const MODE_CONFIG = ["cash", "tournament"] as const;

function selected<T extends string>(value: string | undefined, all: readonly T[]) {
  if (!value) return [...all];
  const wanted = new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
  return all.filter((item) => wanted.has(item));
}

const selectedVariants = CORE5_VARIANTS.filter((variant) =>
  selected(process.env.BROWSER_GAMEPLAY_VARIANTS, CORE5_VARIANTS.map((item) => item.variant)).includes(variant.variant),
);
const selectedModes = selected(process.env.BROWSER_GAMEPLAY_MODES, MODE_CONFIG);
const selectedViewports = selected(process.env.BROWSER_GAMEPLAY_VIEWPORTS, Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>);
const handsPerCombo = Math.max(1, Number(process.env.BROWSER_GAMEPLAY_HANDS ?? 1));
const maxSteps = Math.max(20, Number(process.env.BROWSER_GAMEPLAY_MAX_STEPS ?? 90));

const summaryRows: any[] = [];
const failures: any[] = [];

function ensureDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureDir();
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTrace(fileName: string, rows: any[]) {
  ensureDir();
  const tracePath = path.join(REPORT_DIR, fileName);
  fs.writeFileSync(tracePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return tracePath;
}

function playerBet(player: any) {
  return Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0;
}

async function openVariantMode(page: Page, variant: (typeof CORE5_VARIANTS)[number], mode: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.variant}`);
  await waitForE2EDriver(page);
  if (mode === "tournament") {
    await page.evaluate((variantId) => {
      window.__BADUGI_E2E__?.startTournamentMTT?.({
        id: `browser-gameplay-${String(variantId).toLowerCase()}`,
        name: "Browser Gameplay Invariant",
        tables: 1,
        seatsPerTable: 6,
        startingStack: 5000,
        gameVariant: variantId,
        gameRotation: [variantId],
        rotationPolicy: "fixed",
        levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
    }, variant.variant);
  }
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.evaluate(() => window.__MGX_CLEAR_GAMEPLAY_TRACE__?.());
}

async function collect(page: Page, context: any, action: any, traceRows: any[]) {
  let row: any = null;
  let assertion: ReturnType<typeof assertBrowserGameplayInvariants> | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 20 : 75);
    row = await page.evaluate(
      ({ label, mode, action }) => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label, mode, action }),
      { label: context.label, mode: context.mode, action },
    );
    if (!row) throw new Error("browser gameplay snapshot API unavailable");
    assertion = assertBrowserGameplayInvariants(row, traceRows);
    if (!assertion.violations.some((violation: any) => violation?.severity === "P0")) {
      break;
    }
  }
  if (!row || !assertion) throw new Error("browser gameplay snapshot API unavailable");
  const enriched = { ...row, expected: assertion.expected, violations: assertion.violations };
  traceRows.push(enriched);
  let screenshotPath: string | null = null;
  if (assertion.violations.length > 0) {
    ensureDir();
    const slug = [
      context.variantId,
      context.mode,
      context.viewport,
      row.handId ?? "no-hand",
      row.betRound ?? "b",
      row.drawRound ?? "d",
      traceRows.length,
    ]
      .map((part) => String(part).replace(/[^a-z0-9_-]+/gi, "-"))
      .join("-");
    screenshotPath = path.join(SCREENSHOT_DIR, `browser-gameplay-failure-${slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  for (const violation of assertion.violations) {
    failures.push({
      severity: violation.severity,
      type: violation.type,
      variantId: context.variantId,
      mode: context.mode,
      viewport: context.viewport,
      handId: row.handId,
      betRound: row.betRound,
      drawRound: row.drawRound,
      expected: assertion.expected,
      actual: {
        actorSeat: row.controller?.actorSeat,
        heroControlsVisible: row.ui?.heroControlsVisible,
        displayedPot: row.ui?.displayedPot,
        controllerPot: row.controller?.pot,
      },
      message: violation.message,
      tracePath: context.tracePath ?? null,
      screenshotPath,
    });
  }
  return enriched;
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

async function applyPayload(page: Page, progress: any, payload: any) {
  const actor = progress?.actor;
  if (typeof actor !== "number") {
    await waitForProgressChange(page, progressKey(progress), { timeout: 3000 }).catch(() => {});
    const after = await getProgressState(page);
    if (progressKey(after) !== progressKey(progress) || after?.isTerminal) {
      return { acted: true, clickedAction: "auto-progress-no-actor", actor, payload };
    }
    return { acted: false, clickedAction: "no-actor", actor, payload };
  }
  if (actor !== 0 && String(progress?.phase ?? "").toUpperCase() === "DRAW") {
    const beforeKey = progressKey(progress);
    await waitForProgressChange(page, beforeKey, { timeout: 1200 }).catch(() => {});
    const after = await getProgressState(page);
    if (progressKey(after) !== beforeKey || after?.isTerminal) {
      return { acted: true, clickedAction: "auto-cpu-draw", actor, payload };
    }
  }
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
    if (testId) {
      await page.getByTestId(testId).first().click();
      return { acted: true, clickedAction: testId, actor, payload };
    }
  }
  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot && payload.type === "draw" && payload.discardIndexes?.length) {
    const fallback = { type: "draw", discardIndexes: [] };
    snapshot = await invokeE2E(page, "forceControllerAction", actor, fallback);
    if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, fallback);
    if (snapshot) {
      return { acted: true, clickedAction: "controller:draw-pat-fallback", actor, payload: fallback };
    }
  }
  if (!snapshot) {
    snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  }
  if (
    !snapshot &&
    String(progress?.phase ?? "").toUpperCase() === "BET" &&
    payload.type !== "fold"
  ) {
    const fallback = { type: "fold" };
    snapshot = await invokeE2E(page, "forceControllerAction", actor, fallback);
    if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, fallback);
    if (snapshot) {
      return { acted: true, clickedAction: "controller:fold-fallback", actor, payload: fallback };
    }
  }
  if (!snapshot && payload.type === "raise") {
    const fallback = choosePayload(progress, 1);
    snapshot = await invokeE2E(page, "forceControllerAction", actor, fallback);
    if (!snapshot) snapshot = await invokeE2E(page, "forceSeatAction", actor, fallback);
    if (!snapshot) {
      await waitForProgressChange(page, progressKey(progress), { timeout: 3000 }).catch(() => {});
      const after = await getProgressState(page);
      if (progressKey(after) !== progressKey(progress)) {
        return { acted: true, clickedAction: "auto-progress-after-raise-fallback", actor, payload: fallback };
      }
    }
    return { acted: Boolean(snapshot), clickedAction: `controller:${fallback.type}`, actor, payload: fallback };
  }
  if (!snapshot && payload.type === "draw") {
    await waitForProgressChange(page, progressKey(progress), { timeout: 9000 }).catch(() => {});
    const after = await getProgressState(page);
    if (progressKey(after) !== progressKey(progress) || after?.isTerminal) {
      return { acted: true, clickedAction: "auto-progress-after-draw-force", actor, payload };
    }
  }
  if (!snapshot) {
    await waitForProgressChange(page, progressKey(progress), { timeout: 2500 }).catch(() => {});
    const after = await getProgressState(page);
    if (progressKey(after) !== progressKey(progress)) {
      return { acted: true, clickedAction: "auto-progress", actor, payload };
    }
  }
  const controllerFailure = !snapshot
    ? await invokeE2E(page, "getLastControllerActionFailure").catch(() => null)
    : null;
  return {
    acted: Boolean(snapshot),
    clickedAction: `controller:${payload.type}`,
    actor,
    payload,
    controllerFailure,
  };
}

async function advanceFromTerminal(page: Page, progress: any) {
  const key = progressKey(progress);
  const nextHand = page.getByRole("button", { name: /next hand/i }).first();
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

async function playHands(page: Page, context: any) {
  const traceRows: any[] = [];
  const counters = {
    actionsObserved: 0,
    raisesObserved: 0,
    callsObserved: 0,
    foldsObserved: 0,
    drawDecisionsObserved: 0,
    reRaisesObserved: 0,
    showdownsObserved: 0,
    handsCompleted: 0,
  };

  await collect(page, { ...context, label: "initial" }, null, traceRows);
  let lastAggressor: number | null = null;

  for (let hand = 0; hand < handsPerCombo; hand += 1) {
    for (let step = 0; step < maxSteps; step += 1) {
      const progress = await getProgressState(page);
      if (progress?.isTerminal) {
        counters.handsCompleted += 1;
        counters.showdownsObserved += 1;
        await collect(page, { ...context, label: "terminal" }, null, traceRows);
        const nextHand = page.getByRole("button", { name: /next hand/i }).first();
        if (hand < handsPerCombo - 1 && await nextHand.isVisible().catch(() => false)) {
          await advanceFromTerminal(page, progress);
        }
        break;
      }

      const beforeKey = progressKey(progress);
      const payload = choosePayload(progress, counters.actionsObserved + 1);
      const acted = await applyPayload(page, progress, payload);
      if (!acted.acted) {
        const haltRow = {
          timestamp: Date.now(),
          variantId: context.variantId,
          mode: context.mode,
          viewport: context.viewport,
          handId: progress?.handId ?? null,
          phase: progress?.phase ?? null,
          drawRound: progress?.drawRoundIndex ?? null,
          betRound: progress?.snapshot?.betRound ?? progress?.phaseState?.betRound ?? null,
          label: `halt-hand-${hand}-step-${step}`,
          progress: summarizeProgressState(progress),
          attemptedAction: payload,
          acted,
          controllerFailure: acted?.controllerFailure ?? null,
          violations: [
            {
              type: "ACTION_APPLICATION_FAILED",
              severity: "P0",
              message: "browser gameplay harness could not apply the selected legal/progress action",
            },
          ],
        };
        traceRows.push(haltRow);
        const partialTracePath = writeTrace(
          path.basename(context.tracePath ?? `browser-gameplay-trace-${context.variantId}-${context.mode}-${context.viewport}.jsonl`),
          traceRows,
        );
        failures.push({
          severity: "P0",
          type: "ACTION_APPLICATION_FAILED",
          variantId: context.variantId,
          mode: context.mode,
          viewport: context.viewport,
          handId: progress?.handId ?? null,
          betRound: haltRow.betRound,
          drawRound: haltRow.drawRound,
          expected: null,
          actual: {
            actorSeat: progress?.actor ?? null,
            attemptedAction: payload,
            controllerFailure: acted?.controllerFailure ?? null,
          },
          message: "selected action could not be applied; expansion stopped",
          tracePath: partialTracePath,
          screenshotPath: null,
        });
      }
      expect(acted.acted, JSON.stringify({ context, hand, step, progress: summarizeProgressState(progress), payload })).toBe(true);
      counters.actionsObserved += 1;
      if (acted.payload.type === "raise") {
        if (lastAggressor !== null && lastAggressor !== acted.actor) counters.reRaisesObserved += 1;
        lastAggressor = acted.actor;
        counters.raisesObserved += 1;
      }
      if (acted.payload.type === "call" || acted.payload.type === "check") counters.callsObserved += 1;
      if (acted.payload.type === "fold") counters.foldsObserved += 1;
      if (acted.payload.type === "draw") counters.drawDecisionsObserved += 1;

      await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => {});
      await collect(page, { ...context, label: `hand-${hand}-step-${step}` }, acted, traceRows);
    }
  }

  return { traceRows, counters };
}

test.describe("Browser gameplay invariant harness", () => {
  test.describe.configure({ timeout: 1800000 });

  test.afterAll(() => {
    const status = failures.some((failure) => failure.severity === "P0") ? "FAIL" : failures.length ? "WARN" : "PASS";
    writeJson(SUMMARY_PATH, {
      generatedAt: new Date().toISOString(),
      status,
      variantsTested: [...new Set(summaryRows.map((row) => row.variantId))],
      modesTested: [...new Set(summaryRows.map((row) => row.mode))],
      viewportsTested: [...new Set(summaryRows.map((row) => row.viewport))],
      handsAttempted: summaryRows.reduce((sum, row) => sum + row.handsAttempted, 0),
      handsCompleted: summaryRows.reduce((sum, row) => sum + row.handsCompleted, 0),
      actionsObserved: summaryRows.reduce((sum, row) => sum + row.actionsObserved, 0),
      raisesObserved: summaryRows.reduce((sum, row) => sum + row.raisesObserved, 0),
      callsObserved: summaryRows.reduce((sum, row) => sum + row.callsObserved, 0),
      foldsObserved: summaryRows.reduce((sum, row) => sum + row.foldsObserved, 0),
      drawDecisionsObserved: summaryRows.reduce((sum, row) => sum + row.drawDecisionsObserved, 0),
      reRaisesObserved: summaryRows.reduce((sum, row) => sum + row.reRaisesObserved, 0),
      showdownsObserved: summaryRows.reduce((sum, row) => sum + row.showdownsObserved, 0),
      invariantViolations: failures.length,
      violationsByType: failures.reduce((map, failure) => {
        map[failure.type] = (map[failure.type] ?? 0) + 1;
        return map;
      }, {} as Record<string, number>),
      rows: summaryRows,
    });
    writeJson(FAILURE_PATH, {
      generatedAt: new Date().toISOString(),
      status,
      failures,
    });
    expect(failures.filter((failure) => failure.severity === "P0"), JSON.stringify(failures, null, 2)).toEqual([]);
  });

  for (const variant of selectedVariants) {
    for (const mode of selectedModes) {
      for (const viewportName of selectedViewports) {
        test(`${variant.game} ${mode} ${viewportName} browser gameplay invariants`, async ({ page }) => {
          const viewport = VIEWPORTS[viewportName];
          await page.setViewportSize(viewport);
          await openVariantMode(page, variant, mode);
          const anticipatedTracePath = path.join(
            REPORT_DIR,
            `browser-gameplay-trace-${variant.variant.toLowerCase()}-${mode}-${viewportName}.jsonl`,
          );
          const context = { variantId: variant.variant, mode, viewport: viewportName, tracePath: anticipatedTracePath };
          const { traceRows, counters } = await playHands(page, context);
          const tracePath = writeTrace(
            `browser-gameplay-trace-${variant.variant.toLowerCase()}-${mode}-${viewportName}.jsonl`,
            traceRows,
          );
          summaryRows.push({
            ...context,
            status: traceRows.some((row) => row.violations?.some((v: any) => v.severity === "P0")) ? "FAIL" : "PASS",
            handsAttempted: handsPerCombo,
            ...counters,
            tracePath,
          });
        });
      }
    }
  }
});
