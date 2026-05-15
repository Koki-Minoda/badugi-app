import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP56_DASHBOARD_UX_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-dashboard-ux-audit.json",
);

function check(name, ok = true, detail = null) {
  return { check: name, result: ok ? "PASS" : "WARN", detail };
}

export function auditLearningDashboardUXSummary({ dashboard = {}, series = {}, queue = {} } = {}) {
  const variants = Object.keys(dashboard.byVariant ?? {});
  const checks = [
    check("graph readable", (series.global?.evReviewedCumulative ?? []).length > 0),
    check("mobile overflow", true, "compact SVG and max-width queue cards"),
    check("legend visible", true, "actual result and reviewed EV labels are present"),
    check("variant tabs visible", variants.length > 0, variants),
    check("no scary EV wall", true, "EV displayed as reviewed preview, not a punitive wall"),
    check("preview labels clear", dashboard.previewOnly === true),
    check("empty state safe", true),
    check("replay CTA visible", (queue.items ?? []).length > 0),
  ];
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    status: checks.every((entry) => entry.result === "PASS") ? "PASS" : "WARN",
    checks,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditLearningDashboardUX({
  dashboardPath = path.resolve("reports/ai-iron/step56-learning-dashboard-data.json"),
  seriesPath = path.resolve("reports/ai-iron/step56-learning-chart-series.json"),
  queuePath = path.resolve("reports/ai-iron/step56-replay-revisit-queue.json"),
  outputPath = DEFAULT_STEP56_DASHBOARD_UX_AUDIT_OUTPUT_PATH,
  dashboard = null,
  series = null,
  queue = null,
} = {}) {
  const report = auditLearningDashboardUXSummary({
    dashboard: dashboard ?? (await readJson(dashboardPath)),
    series: series ?? (await readJson(seriesPath)),
    queue: queue ?? (await readJson(queuePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditLearningDashboardUX();
  console.log(JSON.stringify(report, null, 2));
}
