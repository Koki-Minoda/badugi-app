import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP25_ROLLING_BASELINE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step25-rolling-governance-baseline.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function average(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  return list.length ? roundNumber(list.reduce((sum, value) => sum + value, 0) / list.length) : 0;
}

export function buildRollingGovernanceBaseline({ history = [], windowSize = 5 } = {}) {
  const completedRuns = [...(Array.isArray(history) ? history : [])].slice(-windowSize);
  const variants = Array.from(
    new Set(
      completedRuns.flatMap((entry) => Object.keys(entry?.ironProGap ?? {})),
    ),
  ).sort();
  return {
    windowSize,
    sampleCount: completedRuns.length,
    rollingDatasetHitRate: average(completedRuns.map((entry) => entry?.datasetHitRate ?? 0)),
    rollingIronProGap: average(
      completedRuns.flatMap((entry) => variants.map((variant) => entry?.ironProGap?.[variant] ?? 0)),
    ),
    rollingExactOpportunityRate: average(completedRuns.map((entry) => entry?.exactOpportunityRate ?? 0)),
    rollingSameActionRate: average(completedRuns.map((entry) => entry?.sameActionRate ?? 1)),
    rollingFallbackRate: average(completedRuns.map((entry) => entry?.proFallbackRate ?? 1)),
    variants,
    completedRuns,
    outputPath: DEFAULT_STEP25_ROLLING_BASELINE_OUTPUT_PATH,
  };
}

export async function writeRollingGovernanceBaseline({
  history = [],
  windowSize = 5,
  outputPath = DEFAULT_STEP25_ROLLING_BASELINE_OUTPUT_PATH,
} = {}) {
  const report = buildRollingGovernanceBaseline({ history, windowSize });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
