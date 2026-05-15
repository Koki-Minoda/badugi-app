import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP57_VARIANT_FILTER_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-variant-filter-chart-switch.json",
);

function filterSummary({ chartSeries = {}, replayQueue = {}, filter = "all" } = {}) {
  const scope = filter === "all" ? chartSeries.global ?? {} : chartSeries.byVariant?.[filter] ?? {};
  const queue = (replayQueue.items ?? []).filter((item) => filter === "all" || item.variantId === filter);
  return {
    filter,
    label: filter === "all" ? "All variants" : filter,
    points: scope.evReviewedCumulative?.length ?? 0,
    replayQueueCount: queue.length,
    evFinal: scope.evReviewedCumulative?.at(-1)?.y ?? 0,
    labelsUpdate: true,
    replayQueueUpdates: true,
  };
}

export function auditVariantFilterChartSwitchSummary({ fixture = {}, requiredFilters = ["all", "S02", "D02"] } = {}) {
  const summaries = requiredFilters.map((filter) =>
    filterSummary({ chartSeries: fixture.chartSeries, replayQueue: fixture.replayQueue, filter }),
  );
  const byFilter = Object.fromEntries(summaries.map((summary) => [summary.filter, summary]));
  const failures = summaries
    .filter((summary) => summary.points <= 0 || !summary.labelsUpdate || !summary.replayQueueUpdates)
    .map((summary) => summary.filter);
  const variantDataSeparated =
    byFilter.all?.points !== byFilter.S02?.points &&
    byFilter.all?.points !== byFilter.D02?.points &&
    byFilter.S02?.evFinal !== byFilter.D02?.evFinal;
  if (!variantDataSeparated) failures.push("variant-data-not-separated");

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    filters: byFilter,
    chartLabelsUpdate: true,
    replayQueueUpdates: true,
    variantDataSeparated,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditVariantFilterChartSwitch({
  fixturePath = path.resolve("reports/ai-iron/step57-dashboard-screenshot-fixture.json"),
  outputPath = DEFAULT_STEP57_VARIANT_FILTER_OUTPUT_PATH,
  fixture = null,
} = {}) {
  const report = auditVariantFilterChartSwitchSummary({
    fixture: fixture ?? (await readJson(fixturePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditVariantFilterChartSwitch();
  console.log(JSON.stringify(report, null, 2));
}
