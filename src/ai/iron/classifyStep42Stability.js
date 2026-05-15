import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP42_REPEATABILITY_SUMMARY_PATH = path.resolve(
  "reports/ai-iron/step42-repeatability-summary.json",
);
export const DEFAULT_STEP42_DETERMINISM_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step42.json",
);
export const DEFAULT_STEP42_STABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step42-stability-classification.json",
);

export function classifyStep42StabilitySummary({ repeatability = {}, determinism = {} } = {}) {
  const illegal = Number(repeatability.illegal ?? 0);
  const freeze = Number(repeatability.freeze ?? 0);
  const deterministicReplay = determinism.deterministic === true;
  const repeatable =
    repeatability.allRunsHaveExactOpportunities === true &&
    repeatability.allRunsHaveExactHits === true &&
    repeatability.allRunsIronProPositive === true &&
    illegal === 0 &&
    freeze === 0 &&
    deterministicReplay;
  let classification = "PARTIAL";
  if (repeatable) classification = "REPEATABLE";
  if (illegal > 0 || freeze > 0 || determinism.mismatchCount > 0 || determinism.invalidReplayCount > 0) {
    classification = "UNSTABLE";
  }
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    classification,
    deterministicReplay,
    illegal,
    freeze,
    exactOpportunitiesAcrossRuns: repeatability.allRunsHaveExactOpportunities === true,
    exactHitsAcrossRuns: repeatability.allRunsHaveExactHits === true,
    ironProPositiveAcrossRuns: repeatability.allRunsIronProPositive === true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function classifyStep42Stability({
  repeatabilityPath = DEFAULT_STEP42_REPEATABILITY_SUMMARY_PATH,
  determinismPath = DEFAULT_STEP42_DETERMINISM_PATH,
  outputPath = DEFAULT_STEP42_STABILITY_OUTPUT_PATH,
  repeatability = null,
  determinism = null,
} = {}) {
  const report = classifyStep42StabilitySummary({
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await classifyStep42Stability();
  console.log(JSON.stringify(report, null, 2));
}
