import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP43_MIXED_HIT_AUDIT_PATH = path.resolve("reports/ai-iron/step43-mixed-hit-audit.json");
export const DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_PATH = path.resolve(
  "reports/ai-iron/step43-cross-variant-regression.json",
);
export const DEFAULT_STEP43_FALLBACK_COEXISTENCE_PATH = path.resolve(
  "reports/ai-iron/step43-fallback-coexistence.json",
);
export const DEFAULT_STEP43_MIXED_ROBUSTNESS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-mixed-robustness.json",
);

export function summarizeMixedExposureRobustness({ hits = {}, regression = {}, fallback = {} } = {}) {
  const failures = [];
  const warnings = [];
  if (Number(hits.exactHits ?? 0) <= 0) failures.push("mixed-arena-zero-exact-hits");
  if (Number(hits.exactOpportunities ?? 0) <= 0) failures.push("mixed-arena-zero-exact-opportunities");
  if (regression.allIronProPositive !== true) failures.push("iron-pro-not-positive-across-variants");
  if (Number(regression.illegal ?? 0) > 0) failures.push("illegal-action-present");
  if (Number(regression.freeze ?? 0) > 0) failures.push("freeze-present");
  if (fallback.fallbackStable !== true) warnings.push("fallback-coexistence-not-clean");
  let classification = "ROBUST";
  if (failures.length) classification = "FRAGILE";
  else if (warnings.length) classification = "PARTIAL";
  return {
    generatedAt: new Date().toISOString(),
    classification,
    result: classification,
    reason: failures.length ? failures : warnings.length ? warnings : ["mixed-exposure-robust"],
    mixedArenaExactHits: Number(hits.exactHits ?? 0),
    mixedArenaExactOpportunities: Number(hits.exactOpportunities ?? 0),
    allIronProPositive: regression.allIronProPositive === true,
    illegal: Number(regression.illegal ?? 0),
    freeze: Number(regression.freeze ?? 0),
    fallbackStable: fallback.fallbackStable === true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function classifyMixedExposureRobustness({
  hitsPath = DEFAULT_STEP43_MIXED_HIT_AUDIT_PATH,
  regressionPath = DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_PATH,
  fallbackPath = DEFAULT_STEP43_FALLBACK_COEXISTENCE_PATH,
  outputPath = DEFAULT_STEP43_MIXED_ROBUSTNESS_OUTPUT_PATH,
  hits = null,
  regression = null,
  fallback = null,
} = {}) {
  const report = summarizeMixedExposureRobustness({
    hits: hits ?? (await readJson(hitsPath)),
    regression: regression ?? (await readJson(regressionPath)),
    fallback: fallback ?? (await readJson(fallbackPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await classifyMixedExposureRobustness();
  console.log(JSON.stringify(report, null, 2));
}
