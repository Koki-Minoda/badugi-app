import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP24_OPPORTUNITY_FREQUENCY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step24-opportunity-frequency.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

export function auditOpportunityFrequency({
  baselineArena = {},
  currentArena = {},
} = {}) {
  const baselineResults = new Map(
    (Array.isArray(baselineArena?.results) ? baselineArena.results : []).map((result) => [String(result?.variant ?? ""), result]),
  );
  const currentResults = Array.isArray(currentArena?.results) ? currentArena.results : [];

  const variants = currentResults.map((result) => {
    const variant = String(result?.variant ?? "");
    const baseline = baselineResults.get(variant) ?? {};
    return {
      variant,
      baselineDatasetHitRate: roundNumber(baseline?.datasetHitRate ?? 0),
      currentDatasetHitRate: roundNumber(result?.datasetHitRate ?? 0),
      baselineExactOpportunities: Number(baseline?.targetBucketProfile?.exactOpportunities ?? 0),
      currentExactOpportunities: Number(result?.targetBucketProfile?.exactOpportunities ?? 0),
      currentCandidateBucketObservations: result?.candidateBucketObservations ?? {},
      currentFallbackReasonDistribution: result?.fallbackReasonDistribution ?? {},
      matcherRegression:
        Number(result?.illegal ?? 0) > 0 ||
        Number(result?.freeze ?? 0) > 0 ||
        Boolean(result?.fallbackReasonDistribution?.ACTION_ILLEGAL),
      opportunityScarcity:
        Number(result?.datasetHitRate ?? 0) === 0 &&
        Number(result?.illegal ?? 0) === 0 &&
        Number(result?.freeze ?? 0) === 0,
    };
  });

  return {
    variants,
    outputPath: DEFAULT_STEP24_OPPORTUNITY_FREQUENCY_OUTPUT_PATH,
  };
}

export async function writeOpportunityFrequencyAudit({
  baselineArena = {},
  currentArena = {},
  outputPath = DEFAULT_STEP24_OPPORTUNITY_FREQUENCY_OUTPUT_PATH,
} = {}) {
  const report = auditOpportunityFrequency({ baselineArena, currentArena });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
