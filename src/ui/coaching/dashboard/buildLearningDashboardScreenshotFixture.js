import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { buildLearningChartSeriesSummary } from "./buildLearningChartSeries.js";
import { buildLearningDashboardDataSummary } from "./buildLearningDashboardData.js";
import { buildReplayRevisitQueueSummary } from "./buildReplayRevisitQueue.js";

export const DEFAULT_STEP57_SCREENSHOT_FIXTURE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-dashboard-screenshot-fixture.json",
);

const EXTRA_PREVIEW_SESSIONS = [
  {
    sessionId: "step57-preview-session-e",
    variantId: "S02",
    actualDeltaPreview: 12,
    evDeltaReviewed: 18.5,
    lessonCount: 1,
    helpfulCount: 1,
    replayViewedCount: 1,
    handsPlayed: 180,
  },
  {
    sessionId: "step57-preview-session-f",
    variantId: "D02",
    actualDeltaPreview: -4,
    evDeltaReviewed: 12,
    lessonCount: 1,
    helpfulCount: 1,
    replayViewedCount: 0,
    handsPlayed: 180,
  },
  {
    sessionId: "step57-preview-session-g",
    variantId: "S02",
    actualDeltaPreview: 9,
    evDeltaReviewed: 21.5,
    lessonCount: 1,
    helpfulCount: 1,
    replayViewedCount: 1,
    handsPlayed: 180,
  },
  {
    sessionId: "step57-preview-session-h",
    variantId: "D02",
    actualDeltaPreview: 5,
    evDeltaReviewed: 9.5,
    lessonCount: 1,
    helpfulCount: 0,
    replayViewedCount: 0,
    handsPlayed: 180,
  },
];

function sumRows(rows = [], field) {
  return roundNumber(rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0), 4);
}

function bridgeRowFromSession(session, scope = "session") {
  return {
    scope,
    sessionId: session.sessionId,
    variantId: scope === "session" ? "mixed" : session.variantId,
    gameMode: "tournament",
    handsPlayed: Number(session.handsPlayed ?? 180),
    actualDeltaPreview: Number(session.actualDeltaPreview ?? 0),
    evDeltaReviewed: Number(session.evDeltaReviewed ?? 0),
    lessonCount: Number(session.lessonCount ?? 0),
    helpfulCount: Number(session.helpfulCount ?? 0),
    replayViewedCount: Number(session.replayViewedCount ?? 0),
  };
}

function extendBridge(bridge = {}, extraSessions = EXTRA_PREVIEW_SESSIONS) {
  const bySession = { ...(bridge.bySession ?? {}) };
  const bySessionVariant = { ...(bridge.bySessionVariant ?? {}) };

  extraSessions.forEach((session) => {
    bySession[session.sessionId] = bridgeRowFromSession(session);
    bySessionVariant[`${session.sessionId}|${session.variantId}`] = bridgeRowFromSession(session, "session-variant");
  });

  const byVariantRows = Object.values(bySessionVariant);
  const variantIds = Array.from(new Set(byVariantRows.map((row) => row.variantId))).sort();
  const byVariant = Object.fromEntries(
    variantIds.map((variantId) => {
      const rows = byVariantRows.filter((row) => row.variantId === variantId);
      return [
        variantId,
        {
          scope: "variant",
          variantId,
          gameMode: "tournament",
          handsPlayed: sumRows(rows, "handsPlayed"),
          actualDeltaPreview: sumRows(rows, "actualDeltaPreview"),
          evDeltaReviewed: sumRows(rows, "evDeltaReviewed"),
          lessonCount: sumRows(rows, "lessonCount"),
          helpfulCount: sumRows(rows, "helpfulCount"),
          replayViewedCount: sumRows(rows, "replayViewedCount"),
        },
      ];
    }),
  );

  return {
    ...bridge,
    bySession,
    bySessionVariant,
    byVariant,
  };
}

function extendHistory(history = {}, extraSessions = EXTRA_PREVIEW_SESSIONS) {
  const entries = [...(history.entries ?? [])];
  extraSessions.forEach((session, index) => {
    entries.push({
      schemaVersion: 1,
      lessonId: `STEP57_${session.variantId}_PLOT_QA_${index + 1}`,
      variantId: session.variantId,
      lessonTag: session.variantId === "S02" ? "missed-value" : "second-pressure",
      severity: "medium",
      evDelta: session.evDeltaReviewed,
      replayRef: `${session.sessionId}:fixture:1:${index + 2}`,
      replayUrl: `/replay/${session.variantId}/step57/${index + 1}?decision=${index + 2}`,
      replayDeterministic: true,
      timestamp: `2026-05-15T05:0${index}:00.000Z`,
      sessionId: session.sessionId,
      source: "dashboard-plot-preview",
      helpfulState: session.helpfulCount > 0 ? "helpful" : "unset",
      acknowledged: true,
      replayViewed: session.replayViewedCount > 0,
      actionFamily: session.variantId === "S02" ? "CHECK->RAISE" : "CALL->RAISE",
      previewOnly: true,
      pii: false,
      upload: false,
    });
  });
  const variants = Array.from(new Set(entries.map((entry) => entry.variantId ?? "unknownVariant"))).sort();
  const sessions = Array.from(new Set(entries.map((entry) => entry.sessionId))).sort();
  return {
    ...history,
    totalLessons: entries.length,
    sessions,
    variants,
    entries,
  };
}

function extendRecap(recap = {}, history = {}) {
  const entries = history.entries ?? [];
  const byVariant = { ...(recap.byVariant ?? {}) };
  ["D02", "S02"].forEach((variantId) => {
    const rows = entries.filter((entry) => entry.variantId === variantId);
    const leakTag = variantId === "S02" ? "missed-value" : "second-pressure";
    byVariant[variantId] = {
      ...(byVariant[variantId] ?? {}),
      lessonCount: rows.length,
      topLeakTag: leakTag,
      estimatedEVReviewed: sumRows(rows, "evDelta"),
      replayViewedCount: rows.filter((row) => row.replayViewed).length,
      repeatedLeaks: [
        {
          variantId,
          leakTag,
          actionFamily: variantId === "S02" ? "CHECK->RAISE" : "CALL->RAISE",
          count: rows.filter((row) => row.lessonTag === leakTag).length,
          estimatedEVReviewed: sumRows(rows.filter((row) => row.lessonTag === leakTag), "evDelta"),
        },
      ],
    };
  });
  return {
    ...recap,
    byVariant,
    repeatedLeaks: Object.values(byVariant).flatMap((variant) => variant.repeatedLeaks ?? []),
  };
}

export function buildLearningDashboardScreenshotFixtureSummary({
  bridge = {},
  history = {},
  recap = {},
  telemetry = {},
  extraSessions = EXTRA_PREVIEW_SESSIONS,
} = {}) {
  const fixtureBridge = extendBridge(bridge, extraSessions);
  const fixtureHistory = extendHistory(history, extraSessions);
  const fixtureRecap = extendRecap(recap, fixtureHistory);
  const dashboard = buildLearningDashboardDataSummary({
    bridge: fixtureBridge,
    history: fixtureHistory,
    recap: fixtureRecap,
    telemetry,
  });
  const chartSeries = buildLearningChartSeriesSummary({ dashboard });
  const replayQueue = buildReplayRevisitQueueSummary({ history: fixtureHistory, recap: fixtureRecap });

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    uiPlottingFixtureOnly: true,
    usesSyntheticReplay: false,
    usesGameplayMutation: false,
    productionDatasetOverwrite: false,
    extraPreviewSessionCount: extraSessions.length,
    dashboard,
    chartSeries,
    replayQueue,
    expectedPointCounts: {
      global: chartSeries.global.evReviewedCumulative.length,
      S02: chartSeries.byVariant.S02?.evReviewedCumulative.length ?? 0,
      D02: chartSeries.byVariant.D02?.evReviewedCumulative.length ?? 0,
    },
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildLearningDashboardScreenshotFixture({
  bridgePath = path.resolve("reports/ai-iron/step55-variant-session-analytics-bridge.json"),
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  telemetryPath = path.resolve("reports/ai-iron/step55-variant-aware-telemetry.json"),
  outputPath = DEFAULT_STEP57_SCREENSHOT_FIXTURE_OUTPUT_PATH,
  bridge = null,
  history = null,
  recap = null,
  telemetry = null,
} = {}) {
  const report = buildLearningDashboardScreenshotFixtureSummary({
    bridge: bridge ?? (await readJson(bridgePath)),
    history: history ?? (await readJson(historyPath)),
    recap: recap ?? (await readJson(recapPath)),
    telemetry: telemetry ?? (await readJson(telemetryPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildLearningDashboardScreenshotFixture();
  console.log(JSON.stringify(report, null, 2));
}
