import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { aggregateCoachingTelemetryByLessonSummary } from "./aggregateCoachingTelemetryByLesson.js";

export const DEFAULT_STEP53_PRIORITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-lesson-priority-scores.json",
);

const SEVERITY_WEIGHT = Object.freeze({
  low: 4,
  medium: 10,
  high: 18,
  critical: 24,
});

const LESSON_TAG_WEIGHT = Object.freeze({
  "missed-value": 8,
  "missed-value-raise": 8,
  overfold: 6,
  "thin-value": 5,
});

function exactHitRate(lesson = {}) {
  const hits = Number(lesson.exactHits ?? lesson.exactHitCount ?? 0);
  const opportunities = Number(lesson.exactOpportunities ?? lesson.exactOpportunityCount ?? 0);
  if (opportunities <= 0) return Number(lesson.exactHitRate ?? 0);
  return hits / opportunities;
}

function helpfulBonus(telemetry = {}) {
  const helpfulRate = Number(telemetry.helpfulRate ?? 0);
  const helpful = Number(telemetry.helpful ?? 0);
  const notHelpful = Number(telemetry.notHelpful ?? 0);
  if (helpful + notHelpful <= 0) return 0;
  return helpfulRate * 8;
}

export function scoreSingleCoachingLessonPriority({
  lesson = {},
  telemetry = {},
  duplicatePenalty = 0,
} = {}) {
  const evScore = Math.min(Math.abs(Number(lesson.estimatedEVGain ?? lesson.evDelta ?? 0)), 60) * 0.75;
  const severityScore = SEVERITY_WEIGHT[String(lesson.severity ?? "low").toLowerCase()] ?? 3;
  const tagScore = LESSON_TAG_WEIGHT[String(lesson.lessonTag ?? "").toLowerCase()] ?? 2;
  const confidenceScore = Number(lesson.confidence ?? 0.95) * 12;
  const exactScore = exactHitRate(lesson) * 10;
  const replayScore = lesson.replayDeterministic === true ? 8 : -12;
  const primaryScore = lesson.primaryTournamentLeak ? 4 : 0;
  const score =
    evScore +
    severityScore +
    tagScore +
    confidenceScore +
    exactScore +
    replayScore +
    primaryScore +
    helpfulBonus(telemetry) -
    duplicatePenalty;

  const reasons = [
    `ev=${roundNumber(evScore, 4)}`,
    `severity=${roundNumber(severityScore, 4)}`,
    `confidence=${roundNumber(confidenceScore, 4)}`,
    `exactHitRate=${roundNumber(exactHitRate(lesson), 4)}`,
  ];
  if (lesson.replayDeterministic === true) reasons.push("deterministic-replay");
  if (duplicatePenalty > 0) reasons.push(`duplicatePenalty=${roundNumber(duplicatePenalty, 4)}`);
  if (Number(telemetry.helpful ?? 0) > 0) reasons.push(`helpfulRate=${roundNumber(telemetry.helpfulRate, 4)}`);

  return {
    ...lesson,
    priorityScore: roundNumber(score, 4),
    priorityReasons: reasons,
    exactHitRate: roundNumber(exactHitRate(lesson), 4),
  };
}

export function scoreCoachingLessonPrioritiesSummary({
  lessons = [],
  telemetryByLesson = {},
  duplicatePenalties = {},
} = {}) {
  const scoredLessons = lessons
    .map((lesson) =>
      scoreSingleCoachingLessonPriority({
        lesson,
        telemetry: telemetryByLesson[lesson.lessonId] ?? {},
        duplicatePenalty: Number(duplicatePenalties[lesson.lessonId] ?? 0),
      }),
    )
    .sort((a, b) => b.priorityScore - a.priorityScore || String(a.lessonId).localeCompare(String(b.lessonId)));

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    deterministicSorting: true,
    tieBreaker: "lessonId-asc",
    lessons: scoredLessons,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function scoreCoachingLessonPriority({
  coachingViewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  telemetryPath = path.resolve("reports/ai-iron/step52-coaching-engagement-preview.json"),
  outputPath = DEFAULT_STEP53_PRIORITY_OUTPUT_PATH,
  lessons = null,
  telemetryReport = null,
} = {}) {
  const coaching = lessons ? { lessons } : await readJson(coachingViewModelPath);
  const telemetry =
    telemetryReport ??
    aggregateCoachingTelemetryByLessonSummary({
      events: (await readJson(telemetryPath)).events ?? [],
    });
  const report = scoreCoachingLessonPrioritiesSummary({
    lessons: coaching.lessons ?? [],
    telemetryByLesson: telemetry.lessonsById ?? {},
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await scoreCoachingLessonPriority();
  console.log(JSON.stringify(report, null, 2));
}
