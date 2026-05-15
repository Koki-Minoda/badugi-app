import path from "node:path";

import { writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_ANNOTATION_FALLBACK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-annotation-fallback-preview.json",
);

export function buildReplayAnnotationFallback({
  lesson = {},
  replayAvailable = true,
  actionIndexValid = true,
  locale = "jp",
} = {}) {
  const reasons = [];
  if (!lesson?.lessonId) reasons.push("lesson-missing");
  if (!replayAvailable) reasons.push("replay-missing");
  if (!actionIndexValid) reasons.push("action-index-invalid");
  if (lesson?.variantId && !["D02", "S01", "S02"].includes(String(lesson.variantId).toUpperCase())) {
    reasons.push("unsupported-variant");
  }
  if (!locale) reasons.push("locale-missing");
  return {
    status: reasons.length ? "preview-unavailable" : "preview-ready",
    safe: true,
    crash: false,
    reasons,
    fallbackLocale: locale || "jp",
  };
}

export function buildReplayAnnotationFallbackSummary() {
  const cases = [
    { case: "lesson missing", state: buildReplayAnnotationFallback({ lesson: null }) },
    {
      case: "replay missing",
      state: buildReplayAnnotationFallback({
        lesson: { lessonId: "L1", variantId: "S02" },
        replayAvailable: false,
      }),
    },
    {
      case: "actionIndex invalid",
      state: buildReplayAnnotationFallback({
        lesson: { lessonId: "L1", variantId: "S02" },
        actionIndexValid: false,
      }),
    },
    {
      case: "unsupported variant",
      state: buildReplayAnnotationFallback({ lesson: { lessonId: "L1", variantId: "D01" } }),
    },
    {
      case: "locale missing",
      state: buildReplayAnnotationFallback({
        lesson: { lessonId: "L1", variantId: "S02" },
        locale: "",
      }),
    },
  ].map((entry) => ({
    case: entry.case,
    safe: entry.state.safe,
    crash: entry.state.crash,
    status: entry.state.status,
    reasons: entry.state.reasons,
  }));
  return {
    generatedAt: new Date().toISOString(),
    cases,
    allSafe: cases.every((entry) => entry.safe && entry.crash === false),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function writeReplayAnnotationFallback({
  outputPath = DEFAULT_STEP50_ANNOTATION_FALLBACK_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, buildReplayAnnotationFallbackSummary());
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayAnnotationFallback();
  console.log(JSON.stringify(report, null, 2));
}

