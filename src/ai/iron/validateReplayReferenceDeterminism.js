import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP48_REPLAY_REFERENCE_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-eval/replay-reference-determinism-step48.json",
);

export function validateReplayReferenceDeterminismSummary({
  replayLinks = {},
  determinism = {},
} = {}) {
  const refs = (replayLinks.links ?? []).map((link) => ({
    lessonId: link.lessonId ?? link.candidateId,
    replayRef: link.replayRef,
    deterministic: link.deterministic ?? link.replayDeterministic === true,
    replayRefValid: link.replayRefValid ?? Boolean(link.replayRef),
  }));
  const deterministic =
    refs.every((ref) => ref.deterministic === true && ref.replayRefValid === true) &&
    determinism.deterministic === true &&
    Number(determinism.mismatchCount ?? 0) === 0 &&
    Number(determinism.invalidReplayCount ?? 0) === 0;
  return {
    generatedAt: new Date().toISOString(),
    source: "step48-replay-links-plus-step47-determinism",
    deterministic,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    invalidReplayCount: Number(determinism.invalidReplayCount ?? 0),
    replayReferenceCount: refs.length,
    refs,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function validateReplayReferenceDeterminism({
  replayLinksPath = path.resolve("reports/ai-iron/step48-replay-links.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-step47.json"),
  outputPath = DEFAULT_STEP48_REPLAY_REFERENCE_DETERMINISM_OUTPUT_PATH,
  replayLinks = null,
  determinism = null,
} = {}) {
  const report = validateReplayReferenceDeterminismSummary({
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await validateReplayReferenceDeterminism();
  console.log(JSON.stringify(report, null, 2));
}
