import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { applyCoachingOverloadGuardSummary } from "./applyCoachingOverloadGuard.js";
import { aggregateCoachingTelemetryByLessonSummary } from "./aggregateCoachingTelemetryByLesson.js";
import { scoreCoachingLessonPrioritiesSummary } from "./scoreCoachingLessonPriority.js";
import { suppressDuplicateCoachingLessonsSummary } from "./suppressDuplicateCoachingLessons.js";

export const DEFAULT_STEP53_SUMMARY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-coaching-summary-viewmodel.json",
);

function lessonTitleJp(lesson = {}) {
  const playerCount = Number(lesson.playerCount ?? 0);
  const prefix = playerCount > 0 ? `${playerCount}人局面の` : "";
  if (lesson.lessonTag === "missed-value") return `${prefix}価値を取り逃した場面`;
  return lesson.lessonTag ?? "学習ポイント";
}

function lessonTitleEn(lesson = {}) {
  const playerCount = Number(lesson.playerCount ?? 0);
  const prefix = playerCount > 0 ? `${playerCount}-player ` : "";
  if (lesson.lessonTag === "missed-value") return `${prefix}missed value spot`;
  return lesson.lessonTag ?? "Learning point";
}

export function buildCoachingSummaryViewModelSummary({
  lessons = [],
  telemetryEvents = [],
  maxVisible = 3,
} = {}) {
  const telemetry = aggregateCoachingTelemetryByLessonSummary({ events: telemetryEvents });
  const scored = scoreCoachingLessonPrioritiesSummary({
    lessons,
    telemetryByLesson: telemetry.lessonsById,
  });
  const deduped = suppressDuplicateCoachingLessonsSummary({ lessons: scored.lessons });
  const overload = applyCoachingOverloadGuardSummary({ lessons: deduped.finalLessons, maxVisible });
  const topLessons = overload.visibleLessons.map((lesson, index) => ({
    ...lesson,
    titleJp: lessonTitleJp(lesson),
    titleEn: lessonTitleEn(lesson),
    replayCta: {
      labelJp: "リプレイを見る",
      labelEn: "View replay",
      href: lesson.replayUrl ?? null,
      replayRef: lesson.replayRef ?? null,
      deterministic: lesson.replayDeterministic === true,
    },
    rank: index + 1,
  }));
  const totalEstimatedEVGain = roundNumber(
    topLessons.reduce((sum, lesson) => sum + Number(lesson.estimatedEVGain ?? 0), 0),
    4,
  );
  const primaryLesson = topLessons[0] ?? null;
  const secondaryLessons = topLessons.slice(1);

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    deterministicOrdering: true,
    lessonCount: lessons.length,
    visibleLessonCount: topLessons.length,
    totalEstimatedEVGain,
    primaryLesson,
    secondaryLessons,
    topLessons,
    summary: {
      jp: `今回の学習ポイント ${topLessons.length}件`,
      en: `${topLessons.length} learning point${topLessons.length === 1 ? "" : "s"} from this tournament`,
    },
    detailLines: {
      jp: topLessons.map((lesson, index) => `${index + 1}. ${lesson.titleJp}`),
      en: topLessons.map((lesson, index) => `${index + 1}. ${lesson.titleEn}`),
    },
    duplicateSuppression: {
      originalCount: deduped.originalCount,
      suppressedCount: deduped.suppressedCount,
      finalCount: deduped.finalCount,
      suppressed: deduped.suppressed,
    },
    overloadGuard: {
      visibleCount: overload.visibleCount,
      hiddenCount: overload.hiddenCount,
      rules: overload.rules,
    },
    telemetryByLesson: telemetry.lessonsById,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingSummaryViewModel({
  coachingViewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  telemetryPath = path.resolve("reports/ai-iron/step52-coaching-engagement-preview.json"),
  outputPath = DEFAULT_STEP53_SUMMARY_OUTPUT_PATH,
  lessons = null,
  telemetryEvents = null,
} = {}) {
  const coaching = lessons ? { lessons } : await readJson(coachingViewModelPath);
  const telemetry = telemetryEvents ? { events: telemetryEvents } : await readJson(telemetryPath);
  const report = buildCoachingSummaryViewModelSummary({
    lessons: coaching.lessons ?? [],
    telemetryEvents: telemetry.events ?? [],
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingSummaryViewModel();
  console.log(JSON.stringify(report, null, 2));
}
