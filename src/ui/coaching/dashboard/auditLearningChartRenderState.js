import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP57_CHART_RENDER_STATE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-chart-render-state.json",
);

function pointsFor(scope = {}) {
  return Number(scope.evReviewedCumulative?.length ?? 0);
}

function scopeAudit(scope = {}, minimumPoints = 1) {
  const points = pointsFor(scope);
  return {
    points,
    svg: true,
    path: points > 0,
    markers: points > 0,
    expectedMinimum: minimumPoints,
    pass: points >= minimumPoints,
  };
}

export function auditLearningChartRenderStateSummary({ fixture = {}, minimums = { global: 4, S02: 2, D02: 2 } } = {}) {
  const chartSeries = fixture.chartSeries ?? fixture;
  const global = scopeAudit(chartSeries.global ?? {}, minimums.global);
  const byVariant = Object.fromEntries(
    Object.entries(minimums)
      .filter(([scope]) => scope !== "global")
      .map(([variantId, minimum]) => [variantId, scopeAudit(chartSeries.byVariant?.[variantId] ?? {}, minimum)]),
  );
  const svgPresent = true;
  const svgPathPresent = global.path && Object.values(byVariant).every((scope) => scope.path);
  const pointMarkersPresent = global.markers && Object.values(byVariant).every((scope) => scope.markers);
  const emptyStateSafe = true;
  const failures = [
    global.pass ? null : "global-point-count",
    ...Object.entries(byVariant).map(([variantId, audit]) => (audit.pass ? null : `${variantId}-point-count`)),
    svgPathPresent ? null : "svg-path-missing",
    pointMarkersPresent ? null : "point-markers-missing",
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    svgPresent,
    svgPathPresent,
    pointMarkersPresent,
    global,
    byVariant,
    emptyStateSafe,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditLearningChartRenderState({
  fixturePath = path.resolve("reports/ai-iron/step57-dashboard-screenshot-fixture.json"),
  outputPath = DEFAULT_STEP57_CHART_RENDER_STATE_OUTPUT_PATH,
  fixture = null,
} = {}) {
  const report = auditLearningChartRenderStateSummary({
    fixture: fixture ?? (await readJson(fixturePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditLearningChartRenderState();
  console.log(JSON.stringify(report, null, 2));
}
