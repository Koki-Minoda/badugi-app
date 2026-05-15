import path from "node:path";

import {
  aggregateBy,
  classifyCandidate,
  loadStep27Evidence,
  roundNumber,
  sum,
  writeJsonReport,
} from "./coverageAuditUtils.js";

export const DEFAULT_STEP27_MEDIUM_EV_LEAK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/medium-ev-leak-candidates-step27.json",
);

function signFlipRate(values = []) {
  const numeric = values.map((value) => Number(value ?? 0)).filter((value) => Number.isFinite(value) && value !== 0);
  if (!numeric.length) return 0;
  const positives = numeric.filter((value) => value > 0).length;
  const negatives = numeric.filter((value) => value < 0).length;
  return Math.min(positives, negatives) / numeric.length;
}

export function mineMediumEVLeaks({
  arenaSummary = [],
  divergenceRows = [],
  minSampleCount = 20,
  topN = 20,
} = {}) {
  const variantSummary = Object.fromEntries(arenaSummary.map((entry) => [entry.variant, entry]));
  const grouped = aggregateBy(divergenceRows, (row) => `${row.variantId}|${row.bucketFamily}`);
  const candidates = [...grouped.values()]
    .map((rows) => {
      const first = rows[0] ?? {};
      const frequency = sum(rows.map((row) => row.frequency));
      const weightedDelta =
        sum(rows.map((row) => Number(row.standardAdvantage ?? 0) * Number(row.frequency ?? 0))) / Math.max(1, frequency);
      const signedDeltas = rows.flatMap((row) => [row.evGap]).filter((value) => Number.isFinite(Number(value)));
      const signFlip = signFlipRate(signedDeltas);
      const confidence = Math.max(0, Math.min(0.95, (frequency / 100) * (1 - signFlip)));
      const summary = variantSummary[first.variantId] ?? {};
      const item = {
        variant: first.variantId,
        bucket: first.bucketFamily,
        handClass: first.handClass,
        sampleCount: frequency,
        meanDelta: roundNumber(weightedDelta, 4),
        frequency,
        signFlipRate: roundNumber(signFlip, 4),
        confidence: roundNumber(confidence, 4),
        proFallbackRate: roundNumber(summary.proFallbackRate ?? 0, 4),
        ironProGap: roundNumber(summary.ironProGap ?? 0, 4),
        standardAdvantage: roundNumber(weightedDelta, 4),
      };
      return {
        ...item,
        classification: classifyCandidate(item),
      };
    })
    .filter((entry) => entry.sampleCount >= minSampleCount)
    .filter((entry) => Math.abs(entry.meanDelta) >= 3 && Math.abs(entry.meanDelta) <= 80)
    .sort((left, right) => {
      const leftScore = left.sampleCount * Math.abs(left.meanDelta) * left.confidence;
      const rightScore = right.sampleCount * Math.abs(right.meanDelta) * right.confidence;
      return rightScore - leftScore;
    })
    .slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    thresholds: {
      minSampleCount,
      meanDeltaRange: [3, 80],
      weakTrashBroadBucketExcludedByClassification: true,
    },
    candidates,
    promoted: false,
    routingChanged: false,
    outputPath: DEFAULT_STEP27_MEDIUM_EV_LEAK_OUTPUT_PATH,
  };
}

export async function writeMediumEVLeaks({
  outputPath = DEFAULT_STEP27_MEDIUM_EV_LEAK_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.arenaSummary || input.divergenceRows ? input : await loadStep27Evidence();
  const report = mineMediumEVLeaks(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeMediumEVLeaks();
  console.log(JSON.stringify(report, null, 2));
}
