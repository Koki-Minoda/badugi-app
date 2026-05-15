import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP24_SMOOTHED_TELEMETRY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step24-smoothed-telemetry.json",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function average(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  return list.length ? roundNumber(list.reduce((sum, value) => sum + value, 0) / list.length) : 0;
}

export function smoothBenchmarkTelemetry({ runs = [], windowSize = 5 } = {}) {
  const history = [...(Array.isArray(runs) ? runs : [])].slice(-windowSize);
  const aggregate = {
    rollingDatasetHitRate: average(history.map((run) => Number(run?.datasetHitRate ?? 0))),
    rollingIronProGap: average(history.map((run) => Number(run?.ironProGap ?? 0))),
    rollingExactOpportunityRate: average(history.map((run) => Number(run?.exactOpportunityRate ?? 0))),
  };
  return {
    windowSize,
    sampleCount: history.length,
    history,
    ...aggregate,
    outputPath: DEFAULT_STEP24_SMOOTHED_TELEMETRY_OUTPUT_PATH,
  };
}

export async function writeSmoothedBenchmarkTelemetry({
  runs = [],
  windowSize = 5,
  outputPath = DEFAULT_STEP24_SMOOTHED_TELEMETRY_OUTPUT_PATH,
} = {}) {
  const report = smoothBenchmarkTelemetry({ runs, windowSize });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
