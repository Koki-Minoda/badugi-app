import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP53_TELEMETRY_AGGREGATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-lesson-telemetry-aggregation.json",
);

const EVENT_TO_FIELD = Object.freeze({
  LESSON_SHOWN: "shown",
  LESSON_OPENED: "opened",
  REPLAY_OPENED: "replayOpened",
  REPLAY_COMPLETED: "replayCompleted",
  LESSON_ACKNOWLEDGED: "acknowledged",
  LESSON_DISMISSED: "dismissed",
  LESSON_HELPFUL: "helpful",
  LESSON_NOT_HELPFUL: "notHelpful",
});

function emptyLesson(lessonId) {
  return {
    lessonId,
    shown: 0,
    opened: 0,
    replayOpened: 0,
    replayCompleted: 0,
    acknowledged: 0,
    dismissed: 0,
    helpful: 0,
    notHelpful: 0,
    helpfulRate: 0,
    replayCompletionRate: 0,
  };
}

export function aggregateCoachingTelemetryByLessonSummary({ events = [] } = {}) {
  const map = new Map();
  events.forEach((event) => {
    if (!event?.lessonId) return;
    if (!map.has(event.lessonId)) map.set(event.lessonId, emptyLesson(event.lessonId));
    const field = EVENT_TO_FIELD[event.type];
    if (field) map.get(event.lessonId)[field] += 1;
  });

  const lessons = [...map.values()]
    .map((entry) => ({
      ...entry,
      helpfulRate: roundNumber(entry.helpful + entry.notHelpful > 0 ? entry.helpful / (entry.helpful + entry.notHelpful) : 0, 4),
      replayCompletionRate: roundNumber(entry.replayOpened > 0 ? entry.replayCompleted / entry.replayOpened : 0, 4),
    }))
    .sort((a, b) => String(a.lessonId).localeCompare(String(b.lessonId)));
  const lessonsById = Object.fromEntries(lessons.map((entry) => [entry.lessonId, entry]));

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    backendUpload: false,
    networkTelemetry: false,
    lessonCount: lessons.length,
    lessons,
    lessonsById,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function aggregateCoachingTelemetryByLesson({
  telemetryPath = path.resolve("reports/ai-iron/step52-coaching-engagement-preview.json"),
  outputPath = DEFAULT_STEP53_TELEMETRY_AGGREGATION_OUTPUT_PATH,
  events = null,
} = {}) {
  const telemetry = events ? { events } : await readJson(telemetryPath);
  const report = aggregateCoachingTelemetryByLessonSummary({ events: telemetry.events ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await aggregateCoachingTelemetryByLesson();
  console.log(JSON.stringify(report, null, 2));
}
