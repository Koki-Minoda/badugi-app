import path from "node:path";

import { average, readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { STEP42_TARGET_BUCKETS, stddev } from "./aggregateStep42Repeatability.js";

export const STEP46_ARENA_PATHS = ["a", "b", "c"].map((run) =>
  path.resolve(`reports/ai-iron/iron-step46-natural-repeat-${run}.json`),
);
export const DEFAULT_STEP46_REPEATABILITY_SUMMARY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step46-natural-repeatability-summary.json",
);

function sumDistribution(distribution = {}, keys = STEP42_TARGET_BUCKETS) {
  return keys.reduce((sum, key) => sum + Number(distribution?.[key] ?? 0), 0);
}

function worstVariantGap(results = []) {
  return results.reduce((worst, result) => Math.min(worst, Number(result.ironProGap ?? 0)), Number.POSITIVE_INFINITY);
}

function summarizeRun(arena = {}, label = "A") {
  const s02 = (arena.results ?? []).find((result) => result.variant === "S02") ?? {};
  const exactOpportunities = sumDistribution(s02.candidateBucketObservations);
  const exactHits = sumDistribution(s02.bucketHitDistribution);
  const illegal = (arena.results ?? []).reduce((sum, result) => sum + Number(result.illegal ?? 0), 0);
  const freeze = (arena.results ?? []).reduce((sum, result) => sum + Number(result.freeze ?? 0), 0);
  const worstIronProGap = worstVariantGap(arena.results ?? []);
  return {
    run: label,
    arenaId: arena.arenaId ?? null,
    exactOpportunities,
    exactHits,
    exactHitRate: roundNumber(exactHits / Math.max(1, exactOpportunities), 4),
    playerCount3Hits: Number(s02.bucketHitDistribution?.[STEP42_TARGET_BUCKETS[0]] ?? 0),
    playerCount4Hits: Number(s02.bucketHitDistribution?.[STEP42_TARGET_BUCKETS[1]] ?? 0),
    datasetHitRate: roundNumber(s02.datasetHitRate, 6),
    proFallbackRate: roundNumber(s02.proFallbackRate ?? s02.fallback, 6),
    ironProGap: roundNumber(s02.ironProGap, 4),
    ironStandardGap: roundNumber(s02.ironStandardGap, 4),
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
    allVariantIronProPositive:
      (arena.results ?? []).length > 0 && (arena.results ?? []).every((result) => Number(result.ironProGap ?? 0) > 0),
    illegal,
    freeze,
    tableSizeObservedShare: s02.tableSizeObservedShare ?? null,
  };
}

function metricSummary(rows = [], key = "") {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter(Number.isFinite);
  return {
    mean: roundNumber(average(values), 6),
    stddev: roundNumber(stddev(values), 6),
    min: roundNumber(Math.min(...values), 6),
    max: roundNumber(Math.max(...values), 6),
  };
}

export function aggregateNaturalMixedRepeatabilitySummary({ arenas = [] } = {}) {
  const labels = ["A", "B", "C"];
  const runs = arenas.map((arena, index) => summarizeRun(arena, labels[index] ?? `run-${index + 1}`));
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    runCount: runs.length,
    runs,
    metrics: {
      exactOpportunities: metricSummary(runs, "exactOpportunities"),
      exactHits: metricSummary(runs, "exactHits"),
      exactHitRate: metricSummary(runs, "exactHitRate"),
      datasetHitRate: metricSummary(runs, "datasetHitRate"),
      proFallbackRate: metricSummary(runs, "proFallbackRate"),
      ironProGap: metricSummary(runs, "ironProGap"),
      ironStandardGap: metricSummary(runs, "ironStandardGap"),
      worstIronProGap: metricSummary(runs, "worstIronProGap"),
    },
    runsWithExactHits: runs.filter((run) => run.exactHits > 0).length,
    allRunsIllegalFree: runs.every((run) => run.illegal === 0),
    allRunsFreezeFree: runs.every((run) => run.freeze === 0),
    allRunsIronProPositive: runs.every((run) => run.allVariantIronProPositive),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function aggregateNaturalMixedRepeatability({
  arenaPaths = STEP46_ARENA_PATHS,
  outputPath = DEFAULT_STEP46_REPEATABILITY_SUMMARY_OUTPUT_PATH,
  arenas = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map((arenaPath) => readJson(arenaPath))));
  const report = aggregateNaturalMixedRepeatabilitySummary({ arenas: loadedArenas });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await aggregateNaturalMixedRepeatability();
  console.log(JSON.stringify(report, null, 2));
}
