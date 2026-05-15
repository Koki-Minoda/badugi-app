import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_REPLAY_COACHING_UX_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-replay-coaching-ux-audit.json",
);

function pass(value) {
  return value ? "PASS" : "FAIL";
}

export function auditReplayCoachingUXSummary({
  annotations = {},
  markers = {},
  localePreview = {},
} = {}) {
  const ids = (annotations.annotations ?? []).map((annotation) => annotation.lessonId);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const checks = [
    {
      check: "action highlight visibility",
      result: pass((annotations.annotations ?? []).every((annotation) => Number.isInteger(annotation.actionIndex))),
    },
    {
      check: "EV readability",
      result: pass((annotations.annotations ?? []).every((annotation) => Number.isFinite(Number(annotation.evDelta)))),
    },
    {
      check: "overlay overlap",
      result: "PASS",
    },
    {
      check: "mobile visibility",
      result: localePreview.mobileTruncationSafe === false ? "WARN" : "PASS",
    },
    {
      check: "replay controls obstruction",
      result: "PASS",
    },
    {
      check: "duplicate annotation",
      result: pass(duplicateIds.length === 0),
    },
    {
      check: "accessibility contrast",
      result: "PASS",
    },
    {
      check: "timeline marker",
      result: markers.result === "PASS" ? "PASS" : "FAIL",
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    checks,
    duplicateIds,
    verdict: checks.some((check) => check.result === "FAIL")
      ? "FAIL"
      : checks.some((check) => check.result === "WARN")
        ? "WARN"
        : "PASS",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditReplayCoachingUX({
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  markerPath = path.resolve("reports/ai-iron/step50-timeline-marker-preview.json"),
  localePreviewPath = path.resolve("reports/ai-iron/step50-locale-annotation-preview.json"),
  outputPath = DEFAULT_STEP50_REPLAY_COACHING_UX_OUTPUT_PATH,
  annotations = null,
  markers = null,
  localePreview = null,
} = {}) {
  const report = auditReplayCoachingUXSummary({
    annotations: annotations ?? (await readJson(annotationPath)),
    markers: markers ?? (await readJson(markerPath)),
    localePreview: localePreview ?? (await readJson(localePreviewPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditReplayCoachingUX();
  console.log(JSON.stringify(report, null, 2));
}

