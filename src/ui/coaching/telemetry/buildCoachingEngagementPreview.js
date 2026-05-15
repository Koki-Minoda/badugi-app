import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { createCoachingTelemetryEvent } from "./schema.js";
import { createCoachingTelemetryStore } from "./store.js";
import { buildTelemetryPreviewInspector } from "./inspector.js";

export const DEFAULT_STEP52_ENGAGEMENT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step52-coaching-engagement-preview.json",
);

const EVENT_PLAN = [
  { type: "LESSON_SHOWN", seconds: 0 },
  { type: "LESSON_OPENED", seconds: 2 },
  { type: "REPLAY_OPENED", seconds: 5 },
  { type: "LESSON_ACKNOWLEDGED", seconds: 8 },
  { type: "LESSON_HELPFUL", seconds: 12 },
  { type: "REPLAY_COMPLETED", seconds: 45 },
];

function timestamp(baseMs, offsetSeconds) {
  return new Date(baseMs + offsetSeconds * 1000).toISOString();
}

export function buildStep52TelemetryEvents({ annotations = [], sessionId = "step52-preview" } = {}) {
  const base = Date.parse("2026-05-15T03:00:00.000Z");
  return annotations.flatMap((lesson, lessonIndex) =>
    EVENT_PLAN.map((entry, entryIndex) =>
      createCoachingTelemetryEvent({
        type: entry.type,
        lesson,
        lessonId: lesson.lessonId,
        replayRef: lesson.replayRef,
        variant: lesson.variantId,
        timestamp: timestamp(base + lessonIndex * 120000, entry.seconds),
        locale: lessonIndex === 0 ? "jp" : "en",
        deviceClass: lessonIndex === 0 ? "mobile" : "desktop",
        replayDeterministic: lesson.deterministic ?? lesson.replayDeterministic,
        actionIndex: lesson.actionIndex,
        evDelta: lesson.evDelta,
        severity: lesson.severity,
        sessionId,
      }),
    ),
  );
}

export function buildCoachingEngagementPreviewSummary({ annotationReport = {} } = {}) {
  const store = createCoachingTelemetryStore({
    sessionId: "step52-preview",
    clock: () => "2026-05-15T03:00:00.000Z",
  });
  const events = buildStep52TelemetryEvents({ annotations: annotationReport.annotations ?? [] });
  events.forEach((event) => store.record(event));
  const orderedEvents = store.getEvents();
  const inspector = buildTelemetryPreviewInspector({ events: orderedEvents });
  return {
    generatedAt: new Date().toISOString(),
    source: "step51-real-replay-annotation-viewmodel",
    previewOnly: true,
    backendUpload: false,
    externalAnalyticsSdk: false,
    networkDependency: false,
    hiddenTelemetry: false,
    schemaTypes: [...new Set(orderedEvents.map((event) => event.type))],
    eventCounts: inspector.metrics.counts,
    metrics: inspector.metrics,
    events: orderedEvents,
    deterministicOrdering: orderedEvents.every((event, idx) => event.sequence === idx + 1),
    exportJsonAvailable: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingEngagementPreview({
  annotationPath = path.resolve("reports/ai-iron/step51-real-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP52_ENGAGEMENT_OUTPUT_PATH,
  annotationReport = null,
} = {}) {
  const report = buildCoachingEngagementPreviewSummary({
    annotationReport: annotationReport ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingEngagementPreview();
  console.log(JSON.stringify(report, null, 2));
}
