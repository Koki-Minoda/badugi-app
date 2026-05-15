import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_TIMELINE_MARKER_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-timeline-marker-preview.json",
);

export function buildReplayTimelineMarkersSummary({ annotations = {} } = {}) {
  const markers = (annotations.annotations ?? []).map((annotation) => ({
    lessonId: annotation.lessonId,
    actionIndex: annotation.actionIndex,
    markerType: "coaching",
    severity: annotation.severity,
    label: annotation.lessonTag,
    result: Number.isInteger(annotation.actionIndex) ? "PASS" : "FAIL",
  }));
  return {
    generatedAt: new Date().toISOString(),
    markers,
    markerCount: markers.length,
    result: markers.every((marker) => marker.result === "PASS") ? "PASS" : "FAIL",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildReplayTimelineMarkers({
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP50_TIMELINE_MARKER_OUTPUT_PATH,
  annotations = null,
} = {}) {
  const report = buildReplayTimelineMarkersSummary({
    annotations: annotations ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayTimelineMarkers();
  console.log(JSON.stringify(report, null, 2));
}

