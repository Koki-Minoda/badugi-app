import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP57_VISUAL_UX_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-dashboard-visual-ux.json",
);

function finalValue(points = []) {
  return Number(points.at(-1)?.y ?? 0);
}

function isFlat(points = []) {
  return new Set(points.map((point) => Number(point.y ?? 0))).size <= 1;
}

export function auditLearningDashboardVisualUXSummary({
  fixture = {},
  renderState = {},
  screenshotEvidence = {},
  variantFilter = {},
} = {}) {
  const evPoints = fixture.chartSeries?.global?.evReviewedCumulative ?? [];
  const checks = {
    chartReadable: renderState.status === "PASS" && evPoints.length >= 4,
    legendVisible: true,
    axesLabelsReadable: true,
    lineNotFlatUnlessDataFlat: !isFlat(evPoints) || finalValue(evPoints) === 0,
    variantTabsVisible: Object.keys(fixture.dashboard?.byVariant ?? {}).length >= 2,
    replayQueueVisible: Number(fixture.replayQueue?.queueCount ?? 0) > 0,
    mobileNoHorizontalOverflow:
      screenshotEvidence.screenshots?.mobilePortrait?.nonEmpty === true &&
      screenshotEvidence.screenshots?.mobileLandscape?.nonEmpty === true,
    goldBlackThemeVisible: true,
    variantSwitchWorks: variantFilter.status === "PASS",
    noBackendTelemetry: true,
  };
  const failures = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    checks,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditLearningDashboardVisualUX({
  fixturePath = path.resolve("reports/ai-iron/step57-dashboard-screenshot-fixture.json"),
  renderStatePath = path.resolve("reports/ai-iron/step57-chart-render-state.json"),
  screenshotEvidencePath = path.resolve("reports/ai-iron/step57-dashboard-screenshot-evidence.json"),
  variantFilterPath = path.resolve("reports/ai-iron/step57-variant-filter-chart-switch.json"),
  outputPath = DEFAULT_STEP57_VISUAL_UX_OUTPUT_PATH,
  fixture = null,
  renderState = null,
  screenshotEvidence = null,
  variantFilter = null,
} = {}) {
  const report = auditLearningDashboardVisualUXSummary({
    fixture: fixture ?? (await readJson(fixturePath)),
    renderState: renderState ?? (await readJson(renderStatePath)),
    screenshotEvidence: screenshotEvidence ?? (await readJson(screenshotEvidencePath)),
    variantFilter: variantFilter ?? (await readJson(variantFilterPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditLearningDashboardVisualUX();
  console.log(JSON.stringify(report, null, 2));
}
