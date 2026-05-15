import fs from "node:fs/promises";
import path from "node:path";

import { readIronMonitorHistory } from "./storeIronMonitorHistory.js";

export const DEFAULT_STEP26_TELEMETRY_STABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step26-telemetry-stability.json",
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

function slope(values = []) {
  const list = numericValues(values);
  if (list.length < 2) return 0;
  const xMean = (list.length - 1) / 2;
  const yMean = average(list);
  const denominator = list.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
  if (denominator === 0) return 0;
  return list.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0) / denominator;
}

function averageIronProGap(entry = {}) {
  const gaps = Object.values(entry?.ironProGap ?? {});
  return average(gaps);
}

function summarizeMetric(values = [], stddevMax = 0) {
  const list = numericValues(values);
  const min = list.length ? Math.min(...list) : 0;
  const max = list.length ? Math.max(...list) : 0;
  return {
    samples: list.length,
    mean: roundNumber(average(list), 6),
    min: roundNumber(min, 6),
    max: roundNumber(max, 6),
    stddev: roundNumber(stddev(list), 6),
    slope: roundNumber(slope(list), 6),
    stddevMax,
    stable: stddev(list) <= stddevMax,
  };
}

export function classifyTelemetryStability({
  history = [],
  minCompletedRuns = 5,
  thresholds = {},
} = {}) {
  const entries = Array.isArray(history) ? history : [];
  const completedRuns = entries.filter(
    (entry) =>
      typeof entry?.rawStatus === "string" &&
      typeof entry?.hardenedStatus === "string" &&
      Number.isFinite(Number(entry?.datasetHitRate)) &&
      Object.values(entry?.ironProGap ?? {}).length > 0 &&
      typeof entry?.deterministicReplay === "boolean",
  );

  const datasetHitRates = completedRuns.map((entry) => Number(entry?.datasetHitRate ?? 0));
  const ironProGaps = completedRuns.map(averageIronProGap);
  const exactOpportunityRates = completedRuns.map((entry) => Number(entry?.exactOpportunityRate ?? 0));
  const sameActionRates = completedRuns.map((entry) => Number(entry?.sameActionRate ?? 1));
  const fallbackRates = completedRuns.map((entry) => Number(entry?.proFallbackRate ?? 1));

  const limits = {
    datasetHitRateStddevMax: Number(thresholds.datasetHitRateStddevMax ?? 0.003),
    ironProGapStddevMax: Number(thresholds.ironProGapStddevMax ?? 1.5),
    exactOpportunityRateStddevMax: Number(thresholds.exactOpportunityRateStddevMax ?? 0.01),
    sameActionRateStddevMax: Number(thresholds.sameActionRateStddevMax ?? 0.01),
    fallbackRateStddevMax: Number(thresholds.fallbackRateStddevMax ?? 0.05),
    degradingIronProSlopeMax: Number(thresholds.degradingIronProSlopeMax ?? -0.25),
  };

  const metricStats = {
    datasetHitRate: summarizeMetric(datasetHitRates, limits.datasetHitRateStddevMax),
    ironProGap: summarizeMetric(ironProGaps, limits.ironProGapStddevMax),
    exactOpportunityRate: summarizeMetric(exactOpportunityRates, limits.exactOpportunityRateStddevMax),
    sameActionRate: summarizeMetric(sameActionRates, limits.sameActionRateStddevMax),
    fallbackRate: summarizeMetric(fallbackRates, limits.fallbackRateStddevMax),
  };

  let stability = "STABLE";
  const reasons = [];
  if (completedRuns.length < minCompletedRuns) {
    stability = "SPARSE";
    reasons.push(`completedRuns ${completedRuns.length} < ${minCompletedRuns}`);
  } else if (!completedRuns.length || Object.values(metricStats).every((metric) => metric.samples === 0)) {
    stability = "NO_SIGNAL";
    reasons.push("no completed telemetry samples");
  } else if (
    metricStats.ironProGap.slope < limits.degradingIronProSlopeMax ||
    completedRuns.filter((entry) => Object.values(entry?.ironProGap ?? {}).some((value) => Number(value ?? 0) < 0)).length >= 3
  ) {
    stability = "DEGRADING";
    reasons.push("negative Iron-Pro trend detected");
  } else if (Object.values(metricStats).some((metric) => !metric.stable)) {
    stability = "VOLATILE";
    reasons.push("one or more rolling metrics exceeded stddev range");
  } else {
    reasons.push("completedRuns >= minimum and stddev within range");
  }

  return {
    stability,
    historyEntries: entries.length,
    completedRuns: completedRuns.length,
    minCompletedRuns,
    metricStats,
    thresholds: limits,
    reasons,
    outputPath: DEFAULT_STEP26_TELEMETRY_STABILITY_OUTPUT_PATH,
  };
}

export async function writeTelemetryStability({
  history = null,
  minCompletedRuns = 5,
  thresholds = {},
  outputPath = DEFAULT_STEP26_TELEMETRY_STABILITY_OUTPUT_PATH,
} = {}) {
  const resolvedHistory = Array.isArray(history) ? history : await readIronMonitorHistory();
  const report = classifyTelemetryStability({ history: resolvedHistory, minCompletedRuns, thresholds });
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
        : DEFAULT_STEP26_TELEMETRY_STABILITY_OUTPUT_PATH,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeTelemetryStability(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
