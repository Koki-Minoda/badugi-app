import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP24_THRESHOLD_HARDENING_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step24-threshold-hardening.json",
);

export function hardenDriftThresholds({
  rawDriftStatus = "PASS",
  sameActionRate = 0,
  ironProGaps = [],
  rollingDatasetHitRateDrop = 0,
  exactOpportunityRateCollapse = false,
} = {}) {
  const hasIronProRegression = (Array.isArray(ironProGaps) ? ironProGaps : []).some(
    (value) => Number(value ?? 0) < 0,
  );
  const sameActionDropObserved = Number(sameActionRate ?? 0) < 0.99;
  const warnForSparseDrop =
    Number(rollingDatasetHitRateDrop ?? 0) > 0.5 && (sameActionDropObserved || hasIronProRegression || exactOpportunityRateCollapse);

  const hardenedStatus = rawDriftStatus === "FAIL" ? "FAIL" : warnForSparseDrop ? "WARN" : "PASS";
  const suppressedFalseWarn = rawDriftStatus === "WARN" && hardenedStatus === "PASS";

  return {
    rawDriftStatus,
    hardenedStatus,
    suppressedFalseWarn,
    policy: {
      warnOnlyIfRollingDropAndGameplaySignal: true,
      requireSameActionDropOrIronProGapDegradation: true,
      requireExactOpportunityRateCollapseForSparseWarning: true,
    },
    outputPath: DEFAULT_STEP24_THRESHOLD_HARDENING_OUTPUT_PATH,
  };
}

export async function writeHardenedDriftThresholds({
  outputPath = DEFAULT_STEP24_THRESHOLD_HARDENING_OUTPUT_PATH,
  ...input
} = {}) {
  const report = hardenDriftThresholds(input);
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
