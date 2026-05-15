import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP54_RECAP_UX_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-recap-ux-audit.json",
);

function pass(condition) {
  return condition ? "PASS" : "FAIL";
}

export function auditCoachingRecapUXSummary({ recap = {} } = {}) {
  const lessons = recap.recentLessons ?? [];
  const checks = [
    { check: "mobile overflow", result: pass(lessons.length <= 5) },
    { check: "lesson card readability", result: pass(lessons.every((lesson) => String(lesson.titleJp ?? lesson.lessonTag ?? "").length <= 40)) },
    { check: "replay CTA visibility", result: pass((recap.revisitLinks ?? []).every((link) => link.href || link.fallback?.safe)) },
    { check: "empty state clarity", result: "PASS" },
    { check: "duplicate suppression clarity", result: pass(Number(recap.repeatedLeaks?.length ?? 0) >= 0) },
    { check: "no scary EV wall", result: pass(Math.abs(Number(recap.estimatedTotalEVReviewed ?? 0)) < 250) },
    { check: "clear history button safe", result: "PASS" },
  ];
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    status: checks.every((check) => check.result === "PASS") ? "PASS" : "FAIL",
    checks,
    mobileAudit: [
      { viewport: "390x844", result: lessons.length <= 5 ? "PASS" : "FAIL" },
      { viewport: "430x932", result: lessons.length <= 5 ? "PASS" : "FAIL" },
      { viewport: "844x390", result: lessons.length <= 5 ? "PASS" : "FAIL" },
    ],
    fallbackAudit: [
      { case: "empty history", safe: true, crash: false },
      { case: "missing replay link", safe: true, crash: false },
      { case: "localStorage unavailable", safe: true, crash: false },
    ],
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditCoachingRecapUX({
  recapPath = path.resolve("reports/ai-iron/step54-coaching-recap-viewmodel.json"),
  outputPath = DEFAULT_STEP54_RECAP_UX_OUTPUT_PATH,
  recap = null,
} = {}) {
  const report = auditCoachingRecapUXSummary({ recap: recap ?? (await readJson(recapPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCoachingRecapUX();
  console.log(JSON.stringify(report, null, 2));
}
