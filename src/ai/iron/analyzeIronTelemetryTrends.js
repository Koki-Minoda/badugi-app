import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP25_TELEMETRY_TRENDS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step25-telemetry-trends.json",
);

function classifyTrend(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  if (!list.length) return "NO_SIGNAL";
  if (list.every((value) => value === 0)) return "SPARSE";
  const first = list[0];
  const last = list[list.length - 1];
  if (last > first) return "IMPROVING";
  if (last < first) return "DEGRADING";
  return "STABLE";
}

export function analyzeIronTelemetryTrends({ history = [] } = {}) {
  const entries = Array.isArray(history) ? history : [];
  return {
    datasetHitRate: classifyTrend(entries.map((entry) => entry?.datasetHitRate ?? 0)),
    ironProGap: classifyTrend(
      entries.map((entry) => {
        const gaps = Object.values(entry?.ironProGap ?? {}).map((value) => Number(value ?? 0));
        return gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : 0;
      }),
    ),
    fallbackRate: classifyTrend(entries.map((entry) => entry?.proFallbackRate ?? 1)),
    exactOpportunity: classifyTrend(entries.map((entry) => entry?.exactOpportunityRate ?? 0)),
    outputPath: DEFAULT_STEP25_TELEMETRY_TRENDS_OUTPUT_PATH,
  };
}

export async function writeIronTelemetryTrends({
  history = [],
  outputPath = DEFAULT_STEP25_TELEMETRY_TRENDS_OUTPUT_PATH,
} = {}) {
  const report = analyzeIronTelemetryTrends({ history });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
