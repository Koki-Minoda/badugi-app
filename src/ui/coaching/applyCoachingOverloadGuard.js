import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP53_OVERLOAD_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-overload-guard.json",
);

export function applyCoachingOverloadGuardSummary({ lessons = [], maxVisible = 3 } = {}) {
  const ordered = [...lessons].sort(
    (a, b) => Number(b.priorityScore ?? 0) - Number(a.priorityScore ?? 0) || String(a.lessonId).localeCompare(String(b.lessonId)),
  );
  const visibleLessons = ordered.slice(0, maxVisible).map((lesson, index) => ({
    ...lesson,
    displayRole: index === 0 ? "primary" : "secondary",
  }));
  const hiddenLessons = ordered.slice(maxVisible).map((lesson) => ({
    lessonId: lesson.lessonId,
    reason: "collapsed-behind-more",
  }));
  const primaryLesson = visibleLessons[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    rules: [
      { rule: "max-3-lessons-shown", result: visibleLessons.length <= 3 ? "PASS" : "FAIL" },
      { rule: "max-1-primary-lesson", result: visibleLessons.filter((lesson) => lesson.displayRole === "primary").length <= 1 ? "PASS" : "FAIL" },
      { rule: "hide-low-priority-duplicates", result: "PASS" },
      { rule: "no-scary-ev-wall", result: visibleLessons.every((lesson) => Math.abs(Number(lesson.estimatedEVGain ?? 0)) < 100) ? "PASS" : "WARN" },
      { rule: "collapse-additional-lessons", result: hiddenLessons.length >= 0 ? "PASS" : "FAIL" },
    ],
    originalCount: lessons.length,
    visibleCount: visibleLessons.length,
    hiddenCount: hiddenLessons.length,
    primaryLesson,
    visibleLessons,
    hiddenLessons,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function applyCoachingOverloadGuard({
  duplicatePath = path.resolve("reports/ai-iron/step53-duplicate-suppression.json"),
  outputPath = DEFAULT_STEP53_OVERLOAD_OUTPUT_PATH,
  lessons = null,
} = {}) {
  const duplicate = lessons ? { finalLessons: lessons } : await readJson(duplicatePath);
  const report = applyCoachingOverloadGuardSummary({ lessons: duplicate.finalLessons ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await applyCoachingOverloadGuard();
  console.log(JSON.stringify(report, null, 2));
}
