import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP44_SCARCITY_CLASSIFICATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-scarcity-classification.json",
);

export function summarizeMixedExposureScarcity({ funnel = {}, collapse = {}, divergence = {}, safety = {} } = {}) {
  let classification = "NATURAL_SCARCITY";
  const reason = [];
  if (Number(safety.illegal ?? 0) > 0 || Number(safety.freeze ?? 0) > 0) {
    classification = "GAMEPLAY_COLLAPSE";
    reason.push("safety-gate-failed");
  } else if (String(divergence.divergenceSource ?? "").includes("targeted-table-size")) {
    classification = "TABLE_DISTRIBUTION_BIAS";
    reason.push("targeted-table-size-exposure-absent-in-mixed");
  } else if (Number(funnel.exactOpportunities ?? 0) > 0 && Number(funnel.exactHits ?? 0) === 0) {
    classification = "MATCHER_FAILURE";
    reason.push("opportunities-present-without-hits");
  } else {
    reason.push("zero-observed-mixed-opportunities-with-clean-safety");
  }
  return {
    generatedAt: new Date().toISOString(),
    classification,
    result: classification,
    reason,
    unsafe: classification === "GAMEPLAY_COLLAPSE",
    matcherFailure: classification === "MATCHER_FAILURE",
    naturalScarcityOrDistributionBias: ["NATURAL_SCARCITY", "TABLE_DISTRIBUTION_BIAS"].includes(classification),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function classifyMixedExposureScarcity({
  funnelPath = path.resolve("reports/ai-iron/step44-opportunity-funnel.json"),
  collapsePath = path.resolve("reports/ai-iron/step44-playercount-collapse.json"),
  divergencePath = path.resolve("reports/ai-iron/step44-targeted-mixed-divergence.json"),
  safetyPath = path.resolve("reports/ai-iron/step43-safety.json"),
  outputPath = DEFAULT_STEP44_SCARCITY_CLASSIFICATION_OUTPUT_PATH,
  funnel = null,
  collapse = null,
  divergence = null,
  safety = null,
} = {}) {
  const report = summarizeMixedExposureScarcity({
    funnel: funnel ?? (await readJson(funnelPath)),
    collapse: collapse ?? (await readJson(collapsePath)),
    divergence: divergence ?? (await readJson(divergencePath)),
    safety: safety ?? (await readJson(safetyPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await classifyMixedExposureScarcity();
  console.log(JSON.stringify(report, null, 2));
}
