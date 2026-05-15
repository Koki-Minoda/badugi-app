import path from "node:path";

import { average, readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const STEP42_ARENA_PATHS = [
  path.resolve("reports/ai-iron/iron-step42-repeatability-arena-a.json"),
  path.resolve("reports/ai-iron/iron-step42-repeatability-arena-b.json"),
];
export const STEP42_TARGET_BUCKETS = [
  "S02 deep RAISE-vs-CHECK playerCount=3",
  "S02 deep RAISE-vs-CHECK playerCount=4",
];
export const DEFAULT_STEP42_REPEATABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step42-repeatability-summary.json",
);

export function stddev(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (numeric.length <= 1) return 0;
  const mean = average(numeric);
  return Math.sqrt(numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (numeric.length - 1));
}

function sumDistribution(distribution = {}, keys = STEP42_TARGET_BUCKETS) {
  return keys.reduce((sum, key) => sum + Number(distribution[key] ?? 0), 0);
}

export function summarizeArenaRepeatability(arena = {}, label = null) {
  const result = (arena.results ?? []).find((entry) => entry.variant === "S02") ?? arena.results?.[0] ?? {};
  const exactOpportunities = sumDistribution(result.candidateBucketObservations ?? {});
  const exactHits = sumDistribution(result.bucketHitDistribution ?? {});
  return {
    run: label ?? arena.arenaId ?? "unknown",
    arenaId: arena.arenaId ?? null,
    exactOpportunities,
    exactHits,
    exactHitRate: roundNumber(exactHits / Math.max(1, exactOpportunities), 4),
    datasetHitRate: roundNumber(result.datasetHitRate, 6),
    fallbackRate: roundNumber(result.proFallbackRate ?? result.fallback, 6),
    ironProGap: roundNumber(result.ironProGap, 4),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
    playerCountHits: {
      3: Number(result.bucketHitDistribution?.[STEP42_TARGET_BUCKETS[0]] ?? 0),
      4: Number(result.bucketHitDistribution?.[STEP42_TARGET_BUCKETS[1]] ?? 0),
    },
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

export function aggregateStep42RepeatabilitySummary({ arenas = [] } = {}) {
  const runs = arenas.map((arena, index) => summarizeArenaRepeatability(arena, index === 0 ? "A" : index === 1 ? "B" : `run-${index + 1}`));
  const metrics = {
    exactOpportunities: metricSummary(runs, "exactOpportunities"),
    exactHits: metricSummary(runs, "exactHits"),
    exactHitRate: metricSummary(runs, "exactHitRate"),
    datasetHitRate: metricSummary(runs, "datasetHitRate"),
    fallbackRate: metricSummary(runs, "fallbackRate"),
    ironProGap: metricSummary(runs, "ironProGap"),
  };
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    runs,
    metrics,
    allRunsHaveExactOpportunities: runs.every((run) => run.exactOpportunities > 0),
    allRunsHaveExactHits: runs.every((run) => run.exactHits > 0),
    allRunsIronProPositive: runs.every((run) => run.ironProGap > 0),
    illegal: runs.reduce((sum, run) => sum + run.illegal, 0),
    freeze: runs.reduce((sum, run) => sum + run.freeze, 0),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function aggregateStep42Repeatability({
  arenaPaths = STEP42_ARENA_PATHS,
  outputPath = DEFAULT_STEP42_REPEATABILITY_OUTPUT_PATH,
  arenas = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map((arenaPath) => readJson(arenaPath))));
  const report = aggregateStep42RepeatabilitySummary({ arenas: loadedArenas });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await aggregateStep42Repeatability();
  console.log(JSON.stringify(report, null, 2));
}
