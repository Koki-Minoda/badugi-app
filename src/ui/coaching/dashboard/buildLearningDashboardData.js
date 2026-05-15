import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP56_DASHBOARD_DATA_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-learning-dashboard-data.json",
);

function sortedValues(object = {}) {
  return Object.entries(object)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([id, value]) => ({ id, ...value }));
}

function totalsFor(rows = []) {
  return {
    actualDeltaPreview: roundNumber(rows.reduce((sum, row) => sum + Number(row.actualDeltaPreview ?? 0), 0), 4),
    evDeltaReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDeltaReviewed ?? 0), 0), 4),
    lessonCount: rows.reduce((sum, row) => sum + Number(row.lessonCount ?? 0), 0),
    replayViewedCount: rows.reduce((sum, row) => sum + Number(row.replayViewedCount ?? 0), 0),
    helpfulCount: rows.reduce((sum, row) => sum + Number(row.helpfulCount ?? 0), 0),
  };
}

function decorateSessions(rows = []) {
  return rows.map((row, index) => ({
    sessionIndex: index + 1,
    sessionId: row.sessionId ?? row.id,
    variantId: row.variantId,
    gameMode: row.gameMode ?? "tournament",
    actualDeltaPreview: Number(row.actualDeltaPreview ?? 0),
    evDeltaReviewed: Number(row.evDeltaReviewed ?? 0),
    lessonCount: Number(row.lessonCount ?? 0),
    replayViewedCount: Number(row.replayViewedCount ?? 0),
    helpfulCount: Number(row.helpfulCount ?? 0),
  }));
}

export function buildLearningDashboardDataSummary({
  bridge = {},
  history = {},
  recap = {},
  telemetry = {},
} = {}) {
  const globalSessions = decorateSessions(sortedValues(bridge.bySession ?? {}));
  const variantIds = Object.keys(bridge.byVariant ?? recap.byVariant ?? {}).sort();
  const byVariant = Object.fromEntries(
    variantIds.map((variantId) => {
      const sessions = decorateSessions(
        sortedValues(bridge.bySessionVariant ?? {}).filter((row) => row.variantId === variantId),
      );
      return [
        variantId,
        {
          variantId,
          sessions,
          totals: totalsFor(sessions),
          repeatedLeaks: recap.byVariant?.[variantId]?.repeatedLeaks ?? [],
          telemetry: telemetry.byVariant?.[variantId] ?? {},
        },
      ];
    }),
  );
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    localOnly: true,
    backendUpload: false,
    global: {
      sessions: globalSessions,
      totals: totalsFor(globalSessions),
      repeatedLeaks: recap.repeatedLeaks ?? [],
      telemetry: telemetry.global ?? {},
    },
    byVariant,
    history: {
      totalLessons: history.totalLessons ?? history.entries?.length ?? 0,
      variants: history.variants ?? variantIds,
    },
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildLearningDashboardData({
  bridgePath = path.resolve("reports/ai-iron/step55-variant-session-analytics-bridge.json"),
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  telemetryPath = path.resolve("reports/ai-iron/step55-variant-aware-telemetry.json"),
  outputPath = DEFAULT_STEP56_DASHBOARD_DATA_OUTPUT_PATH,
  bridge = null,
  history = null,
  recap = null,
  telemetry = null,
} = {}) {
  const report = buildLearningDashboardDataSummary({
    bridge: bridge ?? (await readJson(bridgePath)),
    history: history ?? (await readJson(historyPath)),
    recap: recap ?? (await readJson(recapPath)),
    telemetry: telemetry ?? (await readJson(telemetryPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildLearningDashboardData();
  console.log(JSON.stringify(report, null, 2));
}
