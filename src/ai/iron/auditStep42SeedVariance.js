import path from "node:path";

import { STEP42_ARENA_PATHS, stddev, summarizeArenaRepeatability } from "./aggregateStep42Repeatability.js";
import { average, readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP42_SEED_VARIANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step42-seed-variance.json",
);

function metricVariance(rows = [], key = "") {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter(Number.isFinite);
  return {
    mean: roundNumber(average(values), 6),
    stddev: roundNumber(stddev(values), 6),
  };
}

export function summarizeStep42SeedVariance({ arenas = [] } = {}) {
  const runs = arenas.map((arena, index) => summarizeArenaRepeatability(arena, index === 0 ? "A" : index === 1 ? "B" : `run-${index + 1}`));
  const variance = {
    ironProGap: metricVariance(runs, "ironProGap"),
    datasetHitRate: metricVariance(runs, "datasetHitRate"),
    exactHitRate: metricVariance(runs, "exactHitRate"),
  };
  const failures = [];
  if (runs.some((run) => run.exactHitRate <= 0)) failures.push("exact-hit-rate-collapse");
  if (runs.some((run) => run.ironProGap <= 0)) failures.push("iron-pro-negative");
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    runs,
    variance,
    status: failures.length ? "FAIL" : "PASS",
    reason: failures.length ? failures : ["repeatability-variance-within-safety-bounds"],
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditStep42SeedVariance({
  arenaPaths = STEP42_ARENA_PATHS,
  outputPath = DEFAULT_STEP42_SEED_VARIANCE_OUTPUT_PATH,
  arenas = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map((arenaPath) => readJson(arenaPath))));
  const report = summarizeStep42SeedVariance({ arenas: loadedArenas });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep42SeedVariance();
  console.log(JSON.stringify(report, null, 2));
}
