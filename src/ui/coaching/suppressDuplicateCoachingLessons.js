import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { scoreCoachingLessonPrioritiesSummary } from "./scoreCoachingLessonPriority.js";

export const DEFAULT_STEP53_DUPLICATE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-duplicate-suppression.json",
);

function actionFamily(lesson = {}) {
  return `${String(lesson.baselineAction ?? "").toUpperCase()}->${String(lesson.recommendedAction ?? "").toUpperCase()}`;
}

function replayKey(lesson = {}) {
  const ref = lesson.replayRef == null ? "" : JSON.stringify(lesson.replayRef);
  return `${ref}|${lesson.actionIndex ?? ""}`;
}

export function duplicateConceptKey(lesson = {}) {
  return [
    lesson.variantId ?? lesson.variant ?? "",
    lesson.lessonTag ?? "",
    lesson.spot ?? lesson.bucketFamily ?? "",
    lesson.playerCount ?? "",
    actionFamily(lesson),
  ].join("|");
}

function duplicateKey(lesson = {}) {
  const replay = replayKey(lesson);
  if (replay !== "|") return `replay:${replay}`;
  return `concept:${duplicateConceptKey(lesson)}`;
}

export function suppressDuplicateCoachingLessonsSummary({ lessons = [] } = {}) {
  const scored = lessons.some((lesson) => Number.isFinite(Number(lesson.priorityScore)))
    ? [...lessons].sort((a, b) => b.priorityScore - a.priorityScore || String(a.lessonId).localeCompare(String(b.lessonId)))
    : scoreCoachingLessonPrioritiesSummary({ lessons }).lessons;
  const keptByKey = new Map();
  const suppressed = [];

  scored.forEach((lesson) => {
    const key = duplicateKey(lesson);
    if (!keptByKey.has(key)) {
      keptByKey.set(key, lesson);
      return;
    }
    const kept = keptByKey.get(key);
    suppressed.push({
      lessonId: lesson.lessonId,
      keptLessonId: kept.lessonId,
      reason: key.startsWith("replay:") ? "same-replay-action" : "same-teaching-concept",
      duplicateKey: key,
    });
  });

  const finalLessons = [...keptByKey.values()].sort(
    (a, b) => b.priorityScore - a.priorityScore || String(a.lessonId).localeCompare(String(b.lessonId)),
  );
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    originalCount: lessons.length,
    suppressedCount: suppressed.length,
    finalCount: finalLessons.length,
    finalLessons,
    suppressed,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function suppressDuplicateCoachingLessons({
  priorityPath = path.resolve("reports/ai-iron/step53-lesson-priority-scores.json"),
  outputPath = DEFAULT_STEP53_DUPLICATE_OUTPUT_PATH,
  lessons = null,
} = {}) {
  const priority = lessons ? { lessons } : await readJson(priorityPath);
  const report = suppressDuplicateCoachingLessonsSummary({ lessons: priority.lessons ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await suppressDuplicateCoachingLessons();
  console.log(JSON.stringify(report, null, 2));
}
