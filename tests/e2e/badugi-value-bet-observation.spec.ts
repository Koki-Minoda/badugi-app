import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/ai");
const REPORT_PATH = path.join(REPORT_DIR, "badugi-value-bet-live-observation.json");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function normalizeAction(action: unknown) {
  const lower = String(action ?? "").toLowerCase();
  if (lower === "bet") return "raise";
  return lower;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value || "unknown"] = (acc[value || "unknown"] ?? 0) + 1;
    return acc;
  }, {});
}

async function openBadugiRuntime(page: Page, mode: "cash" | "tournament") {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    window.localStorage.removeItem("dev.aiTierOverride");
    window.__MGX_CPU_DECISION_TRACE__ = [];
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=${mode}&mgxQa=mobile`);
  await waitForE2EDriver(page);
  if (mode === "tournament") {
    await invokeE2E(page, "startTournamentMTT", {
      id: "badugi-value-bet-observation",
      name: "Badugi Value Bet Observation",
      tables: 1,
      seatsPerTable: 6,
      startingStack: 5000,
      gameVariant: "badugi",
      gameRotation: ["badugi"],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
    });
  } else {
    await invokeE2E(page, "forceDealNewHandNow");
  }
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.evaluate(() => {
    window.__MGX_CPU_DECISION_TRACE__ = [];
  });
}

async function clickHeroIfNeeded(page: Page) {
  const progress = await getProgressState(page);
  if (progress?.isTerminal) {
    await invokeE2E(page, "dealNewHandNow").catch(() => null);
    return;
  }
  if (progress?.actor !== 0) return;
  const phase = String(progress?.phase ?? "").toUpperCase();
  if (phase === "DRAW") {
    const drawButton = page.getByTestId("action-draw-selected").first();
    if (await drawButton.isVisible().catch(() => false)) {
      await drawButton.click().catch(() => null);
    } else {
      await invokeE2E(page, "forceSeatDraw", 0, { type: "draw", discardIndexes: [] }).catch(() => null);
    }
    return;
  }
  const preferred = ["action-check", "action-call", "action-fold"];
  for (const testId of preferred) {
    const button = page.getByTestId(testId).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => null);
      return;
    }
  }
}

async function collectCpuTrace(page: Page, targetRows = 8) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await clickHeroIfNeeded(page);
    await page.waitForTimeout(450);
    const rows = await page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []);
    if (Array.isArray(rows) && rows.length >= targetRows) return rows;
  }
  return page.evaluate(() => window.__MGX_CPU_DECISION_TRACE__ ?? []);
}

function summarizeRows(mode: string, rows: any[]) {
  const betRows = rows.filter((row) => String(row?.phase ?? "").toUpperCase() === "BET");
  const valueRows = betRows.filter((row) => row?.valueBetOpportunity === true);
  const pressureRows = betRows.filter((row) => ["raise", "bet"].includes(normalizeAction(row?.finalAction)));
  const missedValueRows = valueRows.filter((row) => !["raise", "bet"].includes(normalizeAction(row?.finalAction)));
  const headsUpRows = betRows.filter((row) => row?.headsUp === true && row?.aggressionOpportunity === true);
  const headsUpPressureRows = headsUpRows.filter((row) => ["raise", "bet"].includes(normalizeAction(row?.finalAction)));
  return {
    mode,
    decisions: rows.length,
    betDecisions: betRows.length,
    decisionSources: countBy(rows.map((row) => String(row?.decisionSource ?? "unknown"))),
    aiTiers: countBy(rows.map((row) => String(row?.aiTier ?? "unknown"))),
    cpuPolicies: countBy(rows.map((row) => String(row?.cpuPolicy ?? "unknown"))),
    handStrengthBuckets: countBy(rows.map((row) => String(row?.handStrengthBucket ?? "unknown"))),
    valueBetOpportunities: valueRows.length,
    valueBetActions: valueRows.length - missedValueRows.length,
    missedValue: missedValueRows.length,
    headsUpPressureOpportunities: headsUpRows.length,
    headsUpPressureActions: headsUpPressureRows.length,
    pressureActions: pressureRows.length,
    meaningfulDecisions: rows.filter((row) => !["check", "fold", "unknown"].includes(normalizeAction(row?.finalAction))).length,
    adapterMismatchRows: rows.filter((row) => row?.adapterMismatch === true).length,
    sampleRows: rows.slice(0, 12).map((row) => ({
      sessionId: row?.sessionId ?? null,
      variantId: row?.variantId ?? null,
      mode: row?.mode ?? null,
      phase: row?.phase ?? null,
      decisionSource: row?.decisionSource ?? null,
      aiTier: row?.aiTier ?? null,
      cpuPolicy: row?.cpuPolicy ?? null,
      finalAction: row?.finalAction ?? null,
      legalActions: row?.legalActions ?? [],
      handStrengthBucket: row?.handStrengthBucket ?? null,
      valueBetOpportunity: row?.valueBetOpportunity ?? false,
      aggressionOpportunity: row?.aggressionOpportunity ?? false,
      adapterMismatch: row?.adapterMismatch ?? false,
    })),
  };
}

test("Badugi live CPU telemetry classifies friend-alpha runtime path and pressure opportunities", async ({ page }) => {
  test.setTimeout(120000);
  ensureReportDir();
  const summaries = [];

  for (const mode of ["cash", "tournament"] as const) {
    await openBadugiRuntime(page, mode);
    const rows = await collectCpuTrace(page, mode === "tournament" ? 6 : 8);
    const summary = summarizeRows(mode, rows);
    summaries.push(summary);
    expect(summary.decisions, `${mode} CPU telemetry rows`).toBeGreaterThan(0);
    expect(summary.decisionSources, `${mode} source attribution`).not.toEqual({ unknown: summary.decisions });
  }

  const aggregateRows = summaries.flatMap((summary) => summary.sampleRows);
  const liveClassification = summaries.some((summary) => summary.decisionSources["pro-overlay"] > 0)
    ? "pro-overlay"
    : summaries.some((summary) => summary.decisionSources.heuristic > 0)
      ? "heuristic"
      : summaries.some((summary) => summary.decisionSources.fallback > 0)
        ? "fallback"
        : "unknown";
  const passiveConfirmed = summaries.some(
    (summary) =>
      summary.valueBetOpportunities > 0 &&
      summary.missedValue === summary.valueBetOpportunities,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    liveClassification,
    passiveConfirmed,
    summaries,
    aggregateRows,
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  expect(liveClassification).not.toBe("unknown");
});
