import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP51_CLARITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step51-coaching-explanation-clarity.json",
);

const FORBIDDEN_CERTAINTY = /\b(GTO|solver|always|must|guaranteed)\b|必ず|絶対|GTO|ソルバー/iu;

function checkAnnotation(annotation = {}) {
  const jp = String(annotation.jp ?? "");
  const en = String(annotation.en ?? "");
  const checks = {
    lessonTitleClear: annotation.lessonTag === "missed-value",
    recommendedActionClear: Boolean(annotation.recommendedAction),
    comparisonActionClear: Boolean(annotation.baselineAction),
    evGainReadable: Number.isFinite(Number(annotation.evDelta)),
    noGtoCertainty: !FORBIDDEN_CERTAINTY.test(`${jp} ${en}`),
    jpNatural: jp.length >= 24 && jp.length <= 140 && jp.includes("可能性"),
    enShort: en.length >= 24 && en.length <= 120,
  };
  const failed = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  return {
    lessonId: annotation.lessonId,
    checks,
    failed,
    status: failed.length ? "FAIL" : "PASS",
  };
}

export function auditCoachingExplanationClaritySummary({ annotationReport = {} } = {}) {
  const lessons = (annotationReport.annotations ?? []).map(checkAnnotation);
  return {
    generatedAt: new Date().toISOString(),
    source: "step51-real-replay-annotation-viewmodel",
    status: lessons.length && lessons.every((lesson) => lesson.status === "PASS") ? "PASS" : "FAIL",
    lessons,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditCoachingExplanationClarity({
  annotationPath = path.resolve("reports/ai-iron/step51-real-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP51_CLARITY_OUTPUT_PATH,
  annotationReport = null,
} = {}) {
  const report = auditCoachingExplanationClaritySummary({
    annotationReport: annotationReport ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCoachingExplanationClarity();
  console.log(JSON.stringify(report, null, 2));
}
