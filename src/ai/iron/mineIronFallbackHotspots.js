import path from "node:path";

import {
  aggregateBy,
  average,
  classifyCandidate,
  loadStep27Evidence,
  roundNumber,
  sum,
  writeJsonReport,
} from "./coverageAuditUtils.js";

export const DEFAULT_STEP27_FALLBACK_HOTSPOTS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-fallback-hotspots-step27.json",
);

export function mineIronFallbackHotspots({
  arenaSummary = [],
  divergenceRows = [],
  topN = 20,
} = {}) {
  const variantSummary = Object.fromEntries(arenaSummary.map((entry) => [entry.variant, entry]));
  const grouped = aggregateBy(divergenceRows, (row) => `${row.variantId}|${row.bucketFamily}`);
  const hotspots = [...grouped.values()]
    .map((rows) => {
      const first = rows[0] ?? {};
      const variant = first.variantId;
      const summary = variantSummary[variant] ?? {};
      const frequency = sum(rows.map((row) => row.frequency));
      const standardAdvantage = roundNumber(sum(rows.map((row) => Number(row.standardAdvantage ?? 0) * Number(row.frequency ?? 0))) / Math.max(1, frequency), 4);
      const confidence = Math.min(0.95, frequency / 120);
      const item = {
        variant,
        bucket: first.bucketFamily,
        handClass: first.handClass,
        frequency,
        standardAdvantage,
        ironProGap: roundNumber(summary.ironProGap ?? 0, 4),
        proFallbackRate: roundNumber(summary.proFallbackRate ?? 0, 4),
        datasetHitRate: roundNumber(summary.datasetHitRate ?? 0, 4),
        meanEvGap: roundNumber(average(rows.map((row) => Math.abs(Number(row.evGap ?? 0))).filter(Number.isFinite)), 4),
        confidence: roundNumber(confidence, 4),
        pressureFamilies: Array.from(new Set(rows.map((row) => row.pressureFamily))).sort(),
      };
      return {
        ...item,
        classification: classifyCandidate(item),
      };
    })
    .filter((entry) => entry.proFallbackRate >= 0.99 && entry.frequency > 0)
    .sort((left, right) => {
      const leftScore = left.frequency * (left.standardAdvantage + Math.max(0, 1.5 - left.ironProGap));
      const rightScore = right.frequency * (right.standardAdvantage + Math.max(0, 1.5 - right.ironProGap));
      return rightScore - leftScore;
    })
    .slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    hotspots,
    promoted: false,
    routingChanged: false,
    outputPath: DEFAULT_STEP27_FALLBACK_HOTSPOTS_OUTPUT_PATH,
  };
}

export async function writeIronFallbackHotspots({
  outputPath = DEFAULT_STEP27_FALLBACK_HOTSPOTS_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.arenaSummary || input.divergenceRows ? input : await loadStep27Evidence();
  const report = mineIronFallbackHotspots(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeIronFallbackHotspots();
  console.log(JSON.stringify(report, null, 2));
}
