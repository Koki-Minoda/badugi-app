import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_ACTION_HIGHLIGHT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-action-highlight-preview.json",
);

export function buildReplayActionHighlightPreviewSummary({ annotations = {} } = {}) {
  const highlights = (annotations.annotations ?? []).map((annotation) => ({
    lessonId: annotation.lessonId,
    actionIndex: annotation.actionIndex,
    highlight: Number.isInteger(annotation.actionIndex),
    highlightAction: annotation.highlightAction,
    scrollFocusPreview: true,
    pulsePreview: true,
  }));
  return {
    generatedAt: new Date().toISOString(),
    highlights,
    result: highlights.every((entry) => entry.highlight) ? "PASS" : "FAIL",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildReplayActionHighlightPreview({
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP50_ACTION_HIGHLIGHT_OUTPUT_PATH,
  annotations = null,
} = {}) {
  const report = buildReplayActionHighlightPreviewSummary({
    annotations: annotations ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayActionHighlightPreview();
  console.log(JSON.stringify(report, null, 2));
}

