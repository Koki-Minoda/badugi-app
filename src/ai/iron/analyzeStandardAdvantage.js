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

export const DEFAULT_STEP27_STANDARD_ADVANTAGE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/standard-advantage-attribution-step27.json",
);

function suspectedCause(entry = {}) {
  const handClass = String(entry.handClass ?? "").toLowerCase();
  if (handClass.includes("weak") || handClass.includes("trash")) return "weak/trash broad bucket; do-not-touch until counterfactual";
  if (entry.category === "missed-value" || entry.category === "underraise") return "standard aggression/value frequency exceeds Pro fallback";
  if (entry.category === "overfold") return "Pro overfold relative to Standard continuation";
  return "standard broad stability exceeds narrow Iron coverage";
}

export function analyzeStandardAdvantage({
  arenaSummary = [],
  divergenceRows = [],
  topN = 20,
} = {}) {
  const variantAdvantage = Object.fromEntries(
    arenaSummary.map((entry) => [entry.variant, entry]),
  );
  const grouped = aggregateBy(
    divergenceRows,
    (entry) => `${entry.variantId}|${entry.bucketFamily}|${entry.standardAction}|${entry.proAction}`,
  );
  const buckets = [...grouped.values()]
    .map((rows) => {
      const first = rows[0] ?? {};
      const variant = first.variantId;
      const variantSummary = variantAdvantage[variant] ?? {};
      const frequency = sum(rows.map((row) => row.frequency));
      const standardAdvantage = roundNumber(sum(rows.map((row) => Number(row.standardAdvantage ?? 0) * Number(row.frequency ?? 0))) / Math.max(1, frequency), 4);
      const standardEV = roundNumber(average(rows.map((row) => row.standardEvDelta).filter((value) => Number.isFinite(Number(value)))), 4);
      const ironEV = Number.isFinite(Number(variantSummary.ironEv)) ? variantSummary.ironEv : null;
      const gap = roundNumber(standardAdvantage || Math.max(0, Number(variantSummary.standardAdvantage ?? 0)), 4);
      const output = {
        variant,
        bucket: first.bucketFamily,
        handClass: first.handClass,
        playerCount: first.playerCountClass,
        position: first.position,
        drawRound: first.drawRound,
        bettingRound: first.bettingRound,
        pressureFamily: first.pressureFamily,
        callBand: first.callBand,
        selectedAction: first.standardAction,
        proAction: first.proAction,
        sourceType: first.sourceType,
        standardEV,
        ironEV,
        gap,
        frequency,
        proFallbackRate: variantSummary.proFallbackRate ?? 0,
        suspectedCause: suspectedCause(first),
      };
      return {
        ...output,
        classification: classifyCandidate({
          ...output,
          standardAdvantage: gap,
          confidence: Math.min(0.95, frequency / 100),
          ironProGap: variantSummary.ironProGap ?? 0,
        }),
      };
    })
    .filter((entry) => entry.gap > 0 || Number(variantAdvantage[entry.variant]?.standardAdvantage ?? 0) > 0)
    .sort((left, right) => right.frequency * right.gap - left.frequency * left.gap)
    .slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      arenaRuns: arenaSummary.map((entry) => entry.variant).length,
      divergenceRows: divergenceRows.length,
    },
    variantSummary: arenaSummary.map((entry) => ({
      variant: entry.variant,
      standardEV: entry.standardEv,
      ironEV: entry.ironEv,
      proEV: entry.proEv,
      gap: roundNumber(entry.standardAdvantage, 4),
      datasetHitRate: entry.datasetHitRate,
      proFallbackRate: entry.proFallbackRate,
    })),
    buckets,
    promoted: false,
    routingChanged: false,
    outputPath: DEFAULT_STEP27_STANDARD_ADVANTAGE_OUTPUT_PATH,
  };
}

export async function writeStandardAdvantageAnalysis({
  outputPath = DEFAULT_STEP27_STANDARD_ADVANTAGE_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.arenaSummary || input.divergenceRows ? input : await loadStep27Evidence();
  const report = analyzeStandardAdvantage(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeStandardAdvantageAnalysis();
  console.log(JSON.stringify(report, null, 2));
}
