import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP56_EV_RESULT_GRAPH_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-ev-result-graph-viewmodel.json",
);

export function buildEVResultGraphViewModelSummary({ dashboard = {}, series = {}, selectedVariant = "all" } = {}) {
  const scope = selectedVariant === "all" ? dashboard.global : dashboard.byVariant?.[selectedVariant];
  const scopeSeries = selectedVariant === "all" ? series.global : series.byVariant?.[selectedVariant];
  if (!scope) {
    return {
      generatedAt: new Date().toISOString(),
      previewOnly: true,
      selectedVariant,
      empty: true,
      fallback: { safe: true, crash: false, reason: "variant-unavailable" },
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    selectedVariant,
    labels: {
      actualResult: "実収支",
      evReviewed: "見直しEV",
      lessonCount: "レッスン数",
      replayViewed: "見直したリプレイ",
    },
    previewNotice: "実収支はローカルプレビュー値です",
    totals: scope.totals,
    series: {
      actualResult: scopeSeries?.actualResultCumulative ?? [],
      evReviewed: scopeSeries?.evReviewedCumulative ?? [],
      lessonCount: scopeSeries?.lessonCountCumulative ?? [],
      replayViewed: scopeSeries?.replayViewedCumulative ?? [],
    },
    empty: (scope.sessions ?? []).length === 0,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildEVResultGraphViewModel({
  dashboardPath = path.resolve("reports/ai-iron/step56-learning-dashboard-data.json"),
  seriesPath = path.resolve("reports/ai-iron/step56-learning-chart-series.json"),
  outputPath = DEFAULT_STEP56_EV_RESULT_GRAPH_OUTPUT_PATH,
  dashboard = null,
  series = null,
  selectedVariant = "all",
} = {}) {
  const report = buildEVResultGraphViewModelSummary({
    dashboard: dashboard ?? (await readJson(dashboardPath)),
    series: series ?? (await readJson(seriesPath)),
    selectedVariant,
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildEVResultGraphViewModel();
  console.log(JSON.stringify(report, null, 2));
}
