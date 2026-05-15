import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP24_SEED_VARIANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step24-seed-variance.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function percentile(values = [], fraction = 0) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

function summarizeMetric(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  if (!list.length) return { mean: 0, stddev: 0, p05: 0, p95: 0 };
  const mean = list.reduce((sum, value) => sum + value, 0) / list.length;
  const variance = list.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, list.length - 1);
  return {
    mean: roundNumber(mean),
    stddev: roundNumber(Math.sqrt(Math.max(0, variance))),
    p05: roundNumber(percentile(list, 0.05)),
    p95: roundNumber(percentile(list, 0.95)),
  };
}

export function auditIronSeedVariance({ arena = {} } = {}) {
  const results = Array.isArray(arena?.results) ? arena.results : [];
  const variants = results.map((result) => {
    const perSeed = Array.isArray(result?.perSeed) ? result.perSeed : [];
    const datasetHitRate = summarizeMetric(perSeed.map((entry) => entry?.datasetHitRate ?? 0));
    const ironProGap = summarizeMetric(perSeed.map((entry) => entry?.ironProGap ?? 0));
    const exactOpportunities = summarizeMetric(
      perSeed.map((entry) => entry?.targetBucketProfile?.exactOpportunities ?? 0),
    );
    return {
      variant: String(result?.variant ?? ""),
      sampleCount: perSeed.length,
      datasetHitRate,
      ironProGap,
      exactOpportunities,
    };
  });

  return {
    variants,
    outputPath: DEFAULT_STEP24_SEED_VARIANCE_OUTPUT_PATH,
  };
}

export async function writeIronSeedVariance({
  arena = {},
  outputPath = DEFAULT_STEP24_SEED_VARIANCE_OUTPUT_PATH,
} = {}) {
  const report = auditIronSeedVariance({ arena });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
