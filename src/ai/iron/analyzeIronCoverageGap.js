import path from "node:path";

import {
  aggregateBy,
  average,
  loadStep27Evidence,
  roundNumber,
  writeJsonReport,
} from "./coverageAuditUtils.js";

export const DEFAULT_STEP27_COVERAGE_GAP_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-coverage-gap-step27.json",
);

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value ?? "")).filter(Boolean))).sort();
}

function summarizeCoverage(divergenceRows = [], coveredBuckets = []) {
  const covered = new Set(coveredBuckets);
  const missing = unique(divergenceRows.map((row) => row.bucketFamily).filter((bucket) => !covered.has(bucket)));
  return {
    bucketCoverage: {
      covered: coveredBuckets,
      missing,
      coverageRate: roundNumber(coveredBuckets.length / Math.max(1, coveredBuckets.length + missing.length), 4),
    },
    handClassCoverage: {
      observed: unique(divergenceRows.map((row) => row.handClass)),
      covered: unique(coveredBuckets.map((bucket) => String(bucket).split(" ")[0])),
    },
    streetCoverage: {
      observed: unique(divergenceRows.map((row) => `draw-${row.drawRound}|bet-${row.bettingRound}`)),
    },
    playerCountCoverage: {
      observed: unique(divergenceRows.map((row) => row.playerCountClass)),
    },
    positionCoverage: {
      observed: unique(divergenceRows.map((row) => row.position)),
    },
    pressureCoverage: {
      observed: unique(divergenceRows.map((row) => row.pressureFamily)),
    },
  };
}

export function analyzeIronCoverageGap({
  arenaSummary = [],
  divergenceRows = [],
} = {}) {
  const byVariant = aggregateBy(divergenceRows, (row) => row.variantId);
  const variants = arenaSummary.map((summary) => {
    const rows = byVariant.get(summary.variant) ?? [];
    const coverage = summarizeCoverage(rows, summary.coveredBuckets ?? []);
    return {
      variant: summary.variant,
      datasetHitRate: summary.datasetHitRate,
      proFallbackRate: summary.proFallbackRate,
      bucketCoverage: coverage.bucketCoverage,
      handClassCoverage: coverage.handClassCoverage,
      streetCoverage: coverage.streetCoverage,
      playerCountCoverage: coverage.playerCountCoverage,
      positionCoverage: coverage.positionCoverage,
      pressureCoverage: coverage.pressureCoverage,
      missingFamily: coverage.bucketCoverage.missing.slice(0, 5).join(", ") || "none observed",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    variants,
    summary: {
      meanDatasetHitRate: roundNumber(average(variants.map((row) => row.datasetHitRate)), 4),
      meanProFallbackRate: roundNumber(average(variants.map((row) => row.proFallbackRate)), 4),
      missingFamilies: unique(variants.flatMap((row) => row.bucketCoverage.missing)),
    },
    promoted: false,
    routingChanged: false,
    outputPath: DEFAULT_STEP27_COVERAGE_GAP_OUTPUT_PATH,
  };
}

export async function writeIronCoverageGapAnalysis({
  outputPath = DEFAULT_STEP27_COVERAGE_GAP_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.arenaSummary || input.divergenceRows ? input : await loadStep27Evidence();
  const report = analyzeIronCoverageGap(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeIronCoverageGapAnalysis();
  console.log(JSON.stringify(report, null, 2));
}
