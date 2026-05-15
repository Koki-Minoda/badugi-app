import fs from "node:fs/promises";
import path from "node:path";

import { classifyTelemetryStability } from "./classifyTelemetryStability.js";
import { readIronMonitorHistory } from "./storeIronMonitorHistory.js";

export const DEFAULT_STEP26_THRESHOLD_CALIBRATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step26-threshold-calibration.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function numericValues(values = []) {
  return values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
}

function average(values = []) {
  const list = numericValues(values);
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;
}

function stddev(values = []) {
  const list = numericValues(values);
  if (list.length < 2) return 0;
  const mean = average(list);
  return Math.sqrt(list.reduce((sum, value) => sum + (value - mean) ** 2, 0) / list.length);
}

function percentile(values = [], percentileValue = 0.5) {
  const list = numericValues(values).sort((left, right) => left - right);
  if (!list.length) return 0;
  const position = (list.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return list[lower];
  const weight = position - lower;
  return list[lower] * (1 - weight) + list[upper] * weight;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function averageIronProGap(entry = {}) {
  return average(Object.values(entry?.ironProGap ?? {}));
}

function distribution(values = []) {
  const list = numericValues(values);
  const min = list.length ? Math.min(...list) : 0;
  const max = list.length ? Math.max(...list) : 0;
  return {
    count: list.length,
    min: roundNumber(min, 6),
    p10: roundNumber(percentile(list, 0.1), 6),
    median: roundNumber(percentile(list, 0.5), 6),
    p90: roundNumber(percentile(list, 0.9), 6),
    max: roundNumber(max, 6),
    stddev: roundNumber(stddev(list), 6),
  };
}

export function calibrateGovernanceThresholds({ history = [], minCompletedRuns = 5 } = {}) {
  const entries = Array.isArray(history) ? history : [];
  const completedRuns = entries.filter(
    (entry) =>
      typeof entry?.rawStatus === "string" &&
      typeof entry?.hardenedStatus === "string" &&
      Number.isFinite(Number(entry?.datasetHitRate)) &&
      Object.values(entry?.ironProGap ?? {}).length > 0 &&
      typeof entry?.deterministicReplay === "boolean",
  );
  const hitRates = completedRuns.map((entry) => Number(entry?.datasetHitRate ?? 0));
  const nonZeroHitRates = hitRates.filter((value) => value > 0);
  const rollingHitRates = completedRuns.map((entry) => Number(entry?.rollingDatasetHitRate ?? 0)).filter((value) => value > 0);
  const observedBaseline = Math.max(percentile(nonZeroHitRates, 0.5), percentile(rollingHitRates, 0.5), 0);
  const hitRateDrops =
    observedBaseline > 0
      ? hitRates.map((value) => clamp((observedBaseline - value) / observedBaseline, 0, 1))
      : hitRates.map(() => 0);
  const averageGaps = completedRuns.map(averageIronProGap);
  const variantNames = Array.from(new Set(completedRuns.flatMap((entry) => Object.keys(entry?.ironProGap ?? {})))).sort();
  const variantGapLowerBounds = Object.fromEntries(
    variantNames.map((variant) => {
      const values = completedRuns.map((entry) => Number(entry?.ironProGap?.[variant] ?? 0));
      return [variant, roundNumber(percentile(values, 0.1) - stddev(values), 2)];
    }),
  );
  const stability = classifyTelemetryStability({ history: completedRuns, minCompletedRuns });
  const datasetHitRateDropMaxRecommended =
    hitRates.length > 0 && hitRates.every((value) => value === 0)
      ? 0.75
      : roundNumber(clamp(percentile(hitRateDrops, 0.9) + 0.1, 0.5, 0.9), 2);
  const consecutiveSparseWarnForReview = stability.stability === "STABLE" ? 5 : 3;
  const ironProGapFailRuns = 3;

  return {
    historyEntries: entries.length,
    completedRuns: completedRuns.length,
    minCompletedRuns,
    sampleStatus: completedRuns.length >= minCompletedRuns ? "ENOUGH_SAMPLE" : "SPARSE",
    stability: stability.stability,
    distributions: {
      datasetHitRate: distribution(hitRates),
      datasetHitRateDrop: distribution(hitRateDrops),
      ironProGap: distribution(averageGaps),
    },
    datasetHitRateDropMaxRecommended,
    ironProGapLowerBoundRecommended: roundNumber(percentile(averageGaps, 0.1) - stddev(averageGaps), 2),
    variantIronProGapLowerBoundsRecommended: variantGapLowerBounds,
    consecutiveSparseWarnForReview,
    ironProGapFailRuns,
    warnNoActionRecommendation: {
      noActionWhen: [
        "hardenedStatus=PASS",
        "deterministicReplay=true",
        "no routingChanged/promoted runs",
        `sparse WARN count < ${consecutiveSparseWarnForReview}`,
      ],
      reviewWhen: [
        `${consecutiveSparseWarnForReview} consecutive sparse WARN runs`,
        "telemetry stability is VOLATILE",
      ],
      escalateWhen: [
        `${ironProGapFailRuns} runs with negative Iron-Pro gap`,
        "deterministicReplay=false",
      ],
    },
    thresholdChanges: "recommendation-only; no policy mutation in Step26",
    outputPath: DEFAULT_STEP26_THRESHOLD_CALIBRATION_OUTPUT_PATH,
  };
}

export async function writeGovernanceThresholdCalibration({
  history = null,
  minCompletedRuns = 5,
  outputPath = DEFAULT_STEP26_THRESHOLD_CALIBRATION_OUTPUT_PATH,
} = {}) {
  const resolvedHistory = Array.isArray(history) ? history : await readIronMonitorHistory();
  const report = calibrateGovernanceThresholds({ history: resolvedHistory, minCompletedRuns });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    minCompletedRuns: Number(options["min-completed-runs"] ?? 5),
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : DEFAULT_STEP26_THRESHOLD_CALIBRATION_OUTPUT_PATH,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceThresholdCalibration(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
