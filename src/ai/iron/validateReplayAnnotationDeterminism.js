import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP50_REPLAY_ANNOTATION_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-eval/replay-annotation-determinism-step50.json",
);

export function validateReplayAnnotationDeterminismSummary({
  annotation = {},
  replayDeterminism = {},
} = {}) {
  const annotations = annotation.annotations ?? [];
  const deterministic =
    annotations.every((entry) => entry.replayDeterministic === true) &&
    replayDeterminism.deterministic === true &&
    Number(replayDeterminism.mismatchCount ?? 0) === 0 &&
    Number(replayDeterminism.invalidReplayCount ?? 0) === 0;
  return {
    generatedAt: new Date().toISOString(),
    deterministic,
    mismatchCount: Number(replayDeterminism.mismatchCount ?? 0),
    invalidReplayCount: Number(replayDeterminism.invalidReplayCount ?? 0),
    annotationCount: annotations.length,
    replayMutation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function validateReplayAnnotationDeterminism({
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-step47.json"),
  outputPath = DEFAULT_STEP50_REPLAY_ANNOTATION_DETERMINISM_OUTPUT_PATH,
  annotation = null,
  replayDeterminism = null,
} = {}) {
  const report = validateReplayAnnotationDeterminismSummary({
    annotation: annotation ?? (await readJson(annotationPath)),
    replayDeterminism: replayDeterminism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await validateReplayAnnotationDeterminism();
  console.log(JSON.stringify(report, null, 2));
}

