import path from "node:path";

import {
  aggregateStep42RepeatabilitySummary,
  STEP42_ARENA_PATHS,
  STEP42_TARGET_BUCKETS,
} from "./aggregateStep42Repeatability.js";
import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP42_HIT_PERSISTENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step42-hit-persistence.json",
);

export function summarizeForcedReplayHitPersistence({ arenas = [] } = {}) {
  const summary = aggregateStep42RepeatabilitySummary({ arenas });
  const playerCounts = [3, 4].map((playerCount, index) => {
    const bucket = STEP42_TARGET_BUCKETS[index];
    const runHits = arenas.map((arena, runIndex) => {
      const result = (arena.results ?? []).find((entry) => entry.variant === "S02") ?? arena.results?.[0] ?? {};
      return {
        run: runIndex === 0 ? "A" : runIndex === 1 ? "B" : `run-${runIndex + 1}`,
        hits: Number(result.bucketHitDistribution?.[bucket] ?? 0),
      };
    });
    return {
      playerCount,
      bucket,
      hits: runHits.reduce((sum, run) => sum + run.hits, 0),
      runHits,
      persistent: runHits.every((run) => run.hits > 0),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    playerCounts,
    allPlayerCountsPersistent: playerCounts.every((entry) => entry.persistent),
    allRunsHaveExactHits: summary.allRunsHaveExactHits,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditForcedReplayHitPersistence({
  arenaPaths = STEP42_ARENA_PATHS,
  outputPath = DEFAULT_STEP42_HIT_PERSISTENCE_OUTPUT_PATH,
  arenas = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map((arenaPath) => readJson(arenaPath))));
  const report = summarizeForcedReplayHitPersistence({ arenas: loadedArenas });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditForcedReplayHitPersistence();
  console.log(JSON.stringify(report, null, 2));
}
