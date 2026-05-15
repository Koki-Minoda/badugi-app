import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP42_STABILITY_PATH = path.resolve("reports/ai-iron/step42-stability-classification.json");
export const DEFAULT_STEP43_MIXED_ROBUSTNESS_PATH = path.resolve("reports/ai-iron/step43-mixed-robustness.json");
export const DEFAULT_STEP43_DETERMINISM_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step43.json",
);
export const DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_PATH = path.resolve(
  "reports/ai-iron/step43-cross-variant-regression.json",
);
export const DEFAULT_STEP43_FALLBACK_COEXISTENCE_PATH = path.resolve(
  "reports/ai-iron/step43-fallback-coexistence.json",
);
export const DEFAULT_STEP43_CONCENTRATION_RISK_PATH = path.resolve("reports/ai-iron/step43-concentration-risk.json");
export const DEFAULT_STEP43_PROMOTION_READINESS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-promotion-readiness.json",
);

export function summarizePromotionReadiness({
  repeatability = {},
  robustness = {},
  determinism = {},
  regression = {},
  fallback = {},
  concentration = {},
} = {}) {
  const checklist = {
    repeatable: repeatability.classification === "REPEATABLE",
    mixedRobust: robustness.classification === "ROBUST",
    deterministic: determinism.deterministic === true && Number(determinism.mismatchCount ?? 0) === 0,
    safetyClean: Number(regression.illegal ?? 0) === 0 && Number(regression.freeze ?? 0) === 0,
    crossVariantStable: regression.allIronProPositive === true,
    fallbackCoexistence: fallback.fallbackStable === true,
    concentrationRiskAcceptable: !["worsened-high-risk", "HIGH"].includes(String(concentration.riskLevel ?? "")),
  };
  const blockers = Object.entries(checklist)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  return {
    generatedAt: new Date().toISOString(),
    decision: blockers.length ? "NOT_READY" : "READY_FOR_GATED_PROMOTION_REVIEW",
    blockers,
    checklist,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function reviewPromotionReadiness({
  repeatabilityPath = DEFAULT_STEP42_STABILITY_PATH,
  robustnessPath = DEFAULT_STEP43_MIXED_ROBUSTNESS_PATH,
  determinismPath = DEFAULT_STEP43_DETERMINISM_PATH,
  regressionPath = DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_PATH,
  fallbackPath = DEFAULT_STEP43_FALLBACK_COEXISTENCE_PATH,
  concentrationPath = DEFAULT_STEP43_CONCENTRATION_RISK_PATH,
  outputPath = DEFAULT_STEP43_PROMOTION_READINESS_OUTPUT_PATH,
  repeatability = null,
  robustness = null,
  determinism = null,
  regression = null,
  fallback = null,
  concentration = null,
} = {}) {
  const report = summarizePromotionReadiness({
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
    robustness: robustness ?? (await readJson(robustnessPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
    regression: regression ?? (await readJson(regressionPath)),
    fallback: fallback ?? (await readJson(fallbackPath)),
    concentration: concentration ?? (await readJson(concentrationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await reviewPromotionReadiness();
  console.log(JSON.stringify(report, null, 2));
}
