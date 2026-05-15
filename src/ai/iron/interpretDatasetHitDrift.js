import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP24_HIT_DRIFT_INTERPRETATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step24-hit-drift-interpretation.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

export function interpretDatasetHitDrift({
  baselineHitRate = 0,
  currentHitRate = 0,
  sameActionRate = 0,
  exactOpportunities = 0,
  deterministicReplay = false,
  invalidReplayCount = 0,
  matcherRegressionSignals = false,
  datasetRegressionSignals = false,
  seedVarianceSignals = false,
} = {}) {
  const details = {
    baselineHitRate: roundNumber(baselineHitRate),
    currentHitRate: roundNumber(currentHitRate),
    sameActionRate: roundNumber(sameActionRate),
    exactOpportunities: Number(exactOpportunities ?? 0),
    deterministicReplay: Boolean(deterministicReplay),
    invalidReplayCount: Number(invalidReplayCount ?? 0),
    matcherRegressionSignals: Boolean(matcherRegressionSignals),
    datasetRegressionSignals: Boolean(datasetRegressionSignals),
    seedVarianceSignals: Boolean(seedVarianceSignals),
  };

  let classification = "UNKNOWN";
  if (
    details.sameActionRate === 1 &&
    details.deterministicReplay &&
    details.invalidReplayCount === 0 &&
    details.exactOpportunities === 0
  ) {
    classification = "OPPORTUNITY_SCARCITY";
  } else if (details.matcherRegressionSignals) {
    classification = "MATCHER_REGRESSION";
  } else if (details.datasetRegressionSignals) {
    classification = "DATASET_REGRESSION";
  } else if (details.seedVarianceSignals) {
    classification = "SEED_VARIANCE";
  }

  return {
    classification,
    details,
    outputPath: DEFAULT_STEP24_HIT_DRIFT_INTERPRETATION_OUTPUT_PATH,
  };
}

export async function writeDatasetHitDriftInterpretation({
  outputPath = DEFAULT_STEP24_HIT_DRIFT_INTERPRETATION_OUTPUT_PATH,
  ...input
} = {}) {
  const report = interpretDatasetHitDrift(input);
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
