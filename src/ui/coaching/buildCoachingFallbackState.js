import path from "node:path";

import { writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_FALLBACK_PREVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-coaching-fallback-preview.json",
);

export function buildCoachingFallbackState({
  replayAvailable = true,
  replayDeterministic = true,
  metadata = {},
  variantId = metadata.variantId,
} = {}) {
  const reasons = [];
  if (!replayAvailable) reasons.push("replay-unavailable");
  if (!replayDeterministic) reasons.push("replay-mismatch");
  if (!metadata || !metadata.lessonId) reasons.push("missing-metadata");
  if (variantId && !["D02", "S01", "S02"].includes(String(variantId).toUpperCase())) {
    reasons.push("unsupported-variant");
  }
  return {
    status: reasons.length ? "preview-unavailable" : "preview-ready",
    safe: true,
    reasons,
    replayAvailable,
    replayDeterministic,
    variantId: variantId ?? null,
    promoted: false,
    routingChanged: false,
  };
}

export function buildCoachingFallbackPreviewSummary() {
  const scenarios = [
    buildCoachingFallbackState({
      replayAvailable: false,
      metadata: { lessonId: "S02_DEEP_RAISECHECK_PC3" },
      variantId: "S02",
    }),
    buildCoachingFallbackState({
      replayDeterministic: false,
      metadata: { lessonId: "S02_DEEP_RAISECHECK_PC3" },
      variantId: "S02",
    }),
    buildCoachingFallbackState({ metadata: {}, variantId: "S02" }),
    buildCoachingFallbackState({
      metadata: { lessonId: "UNSUPPORTED" },
      variantId: "D01",
    }),
  ];
  return {
    generatedAt: new Date().toISOString(),
    scenarios,
    allSafe: scenarios.every((scenario) => scenario.safe === true),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function writeCoachingFallbackPreview({
  outputPath = DEFAULT_STEP48_FALLBACK_PREVIEW_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, buildCoachingFallbackPreviewSummary());
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCoachingFallbackPreview();
  console.log(JSON.stringify(report, null, 2));
}
