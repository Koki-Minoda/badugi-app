import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP44_MIXED_ROBUSTNESS_REVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-mixed-robustness-review.json",
);

export function summarizeMixedRobustnessAfterDiagnosis({ scarcity = {}, repeatability = {}, safety = {} } = {}) {
  const safe = Number(safety.illegal ?? 0) === 0 && Number(safety.freeze ?? 0) === 0 && safety.verdict !== "FAIL";
  const targetedRepeatability = repeatability.classification === "REPEATABLE" || repeatability.allRunsHaveExactHits === true;
  const recoverableScarcity = ["NATURAL_SCARCITY", "TABLE_DISTRIBUTION_BIAS"].includes(String(scarcity.classification ?? ""));
  const classification = safe && targetedRepeatability && recoverableScarcity ? "RECOVERABLE" : safe ? "PARTIAL" : "FRAGILE";
  return {
    generatedAt: new Date().toISOString(),
    classification,
    result: classification,
    reason:
      classification === "RECOVERABLE"
        ? ["unsafe-not-observed", "targeted-repeatability-proven", "scarcity-is-recoverable"]
        : ["mixed-robustness-not-recovered"],
    safe,
    targetedRepeatability,
    scarcityClassification: scarcity.classification ?? null,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function reviewMixedRobustnessAfterDiagnosis({
  scarcityPath = path.resolve("reports/ai-iron/step44-scarcity-classification.json"),
  repeatabilityPath = path.resolve("reports/ai-iron/step42-repeatability-summary.json"),
  safetyPath = path.resolve("reports/ai-iron/step44-safety.json"),
  outputPath = DEFAULT_STEP44_MIXED_ROBUSTNESS_REVIEW_OUTPUT_PATH,
  scarcity = null,
  repeatability = null,
  safety = null,
} = {}) {
  const report = summarizeMixedRobustnessAfterDiagnosis({
    scarcity: scarcity ?? (await readJson(scarcityPath)),
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
    safety: safety ?? (await readJson(safetyPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await reviewMixedRobustnessAfterDiagnosis();
  console.log(JSON.stringify(report, null, 2));
}
