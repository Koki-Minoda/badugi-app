import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP56_CHART_SERIES_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-learning-chart-series.json",
);

function cumulativeSeries(sessions = [], field) {
  let total = 0;
  return sessions.map((session) => {
    total = roundNumber(total + Number(session[field] ?? 0), 4);
    return {
      sessionId: session.sessionId,
      x: session.sessionIndex,
      y: total,
    };
  });
}

function helpfulRateSeries(sessions = []) {
  let helpful = 0;
  let lessons = 0;
  return sessions.map((session) => {
    helpful += Number(session.helpfulCount ?? 0);
    lessons += Number(session.lessonCount ?? 0);
    return {
      sessionId: session.sessionId,
      x: session.sessionIndex,
      y: roundNumber(lessons > 0 ? helpful / lessons : 0, 4),
    };
  });
}

function buildScopeSeries(scope = { sessions: [] }) {
  const sessions = scope.sessions ?? [];
  return {
    actualResultCumulative: cumulativeSeries(sessions, "actualDeltaPreview"),
    evReviewedCumulative: cumulativeSeries(sessions, "evDeltaReviewed"),
    lessonCountCumulative: cumulativeSeries(sessions, "lessonCount"),
    replayViewedCumulative: cumulativeSeries(sessions, "replayViewedCount"),
    helpfulRateBySession: helpfulRateSeries(sessions),
  };
}

export function buildLearningChartSeriesSummary({ dashboard = {} } = {}) {
  const byVariant = Object.fromEntries(
    Object.entries(dashboard.byVariant ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([variantId, scope]) => [variantId, buildScopeSeries(scope)]),
  );
  const perVariantEvReviewed = Object.fromEntries(
    Object.entries(byVariant).map(([variantId, series]) => [variantId, series.evReviewedCumulative]),
  );
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    global: buildScopeSeries(dashboard.global ?? {}),
    byVariant,
    perVariantEvReviewed,
    emptyStateSafe: (dashboard.global?.sessions ?? []).length === 0,
    deterministicOrdering: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildLearningChartSeries({
  dashboardPath = path.resolve("reports/ai-iron/step56-learning-dashboard-data.json"),
  outputPath = DEFAULT_STEP56_CHART_SERIES_OUTPUT_PATH,
  dashboard = null,
} = {}) {
  const report = buildLearningChartSeriesSummary({
    dashboard: dashboard ?? (await readJson(dashboardPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildLearningChartSeries();
  console.log(JSON.stringify(report, null, 2));
}
