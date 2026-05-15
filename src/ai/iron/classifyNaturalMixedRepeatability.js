import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP46_REPEATABILITY_CLASSIFICATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step46-repeatability-classification.json",
);

export function classifyNaturalMixedRepeatabilitySummary({ repeatability = {}, determinism = {} } = {}) {
  const deterministic = determinism.deterministic === true && Number(determinism.mismatchCount ?? 0) === 0;
  const illegalFree = repeatability.allRunsIllegalFree === true;
  const freezeFree = repeatability.allRunsFreezeFree === true;
  const enoughHitRuns = Number(repeatability.runsWithExactHits ?? 0) >= 2;
  const ironProPositive = repeatability.allRunsIronProPositive === true;
  let classification = "PARTIAL";
  const reasons = [];
  if (!illegalFree) reasons.push("illegal-present");
  if (!freezeFree) reasons.push("freeze-present");
  if (!deterministic) reasons.push("determinism-failure");
  if (!enoughHitRuns) reasons.push("exact-hit-repeatability-insufficient");
  if (!ironProPositive) reasons.push("iron-pro-not-positive-all-variants");
  if (illegalFree && freezeFree && deterministic && enoughHitRuns && ironProPositive) {
    classification = "REPEATABLE";
    reasons.push("natural-mixed-repeatability-confirmed");
  } else if (!illegalFree || !freezeFree || !deterministic) {
    classification = "FRAGILE";
  }
  return {
    generatedAt: new Date().toISOString(),
    classification,
    reason: reasons,
    deterministic,
    runsWithExactHits: Number(repeatability.runsWithExactHits ?? 0),
    runCount: Number(repeatability.runCount ?? repeatability.runs?.length ?? 0),
    allRunsIronProPositive: ironProPositive,
    illegalFree,
    freezeFree,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function classifyNaturalMixedRepeatability({
  repeatabilityPath = path.resolve("reports/ai-iron/step46-natural-repeatability-summary.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-iron-step46.json"),
  outputPath = DEFAULT_STEP46_REPEATABILITY_CLASSIFICATION_OUTPUT_PATH,
  repeatability = null,
  determinism = null,
} = {}) {
  const report = classifyNaturalMixedRepeatabilitySummary({
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await classifyNaturalMixedRepeatability();
  console.log(JSON.stringify(report, null, 2));
}
