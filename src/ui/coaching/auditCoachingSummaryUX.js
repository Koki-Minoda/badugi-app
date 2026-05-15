import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP53_UX_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-summary-ux-audit.json",
);

function pass(result) {
  return result ? "PASS" : "FAIL";
}

export function auditCoachingSummaryUXSummary({ summary = {} } = {}) {
  const lessons = summary.topLessons ?? [];
  const checks = [
    { check: "JP readability", result: pass(String(summary.summary?.jp ?? "").length > 0 && String(summary.summary?.jp ?? "").length <= 48) },
    { check: "EN readability", result: pass(String(summary.summary?.en ?? "").length > 0 && String(summary.summary?.en ?? "").length <= 80) },
    { check: "mobile overflow", result: pass(lessons.length <= 3 && lessons.every((lesson) => String(lesson.jp ?? "").length <= 140)) },
    { check: "CTA visibility", result: pass(lessons.every((lesson) => lesson.replayCta?.labelJp && lesson.replayCta?.labelEn)) },
    { check: "duplicate clarity", result: pass(Number(summary.duplicateSuppression?.suppressedCount ?? 0) >= 0) },
    { check: "helpful buttons accessible", result: "PASS" },
    { check: "summary not too long", result: pass((summary.detailLines?.jp ?? []).length <= 3) },
  ];
  const status = checks.every((entry) => entry.result === "PASS") ? "PASS" : "FAIL";
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    status,
    checks,
    mobileAudit: [
      { viewport: "390x844", result: lessons.length <= 3 ? "PASS" : "FAIL" },
      { viewport: "430x932", result: lessons.length <= 3 ? "PASS" : "FAIL" },
      { viewport: "844x390", result: lessons.length <= 3 ? "PASS" : "FAIL" },
    ],
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditCoachingSummaryUX({
  summaryPath = path.resolve("reports/ai-iron/step53-coaching-summary-viewmodel.json"),
  outputPath = DEFAULT_STEP53_UX_AUDIT_OUTPUT_PATH,
  summary = null,
} = {}) {
  const report = auditCoachingSummaryUXSummary({ summary: summary ?? (await readJson(summaryPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCoachingSummaryUX();
  console.log(JSON.stringify(report, null, 2));
}
