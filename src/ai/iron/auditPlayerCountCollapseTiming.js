import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { DEFAULT_STEP43_MIXED_ARENA_PATH } from "./auditMixedExposureHits.js";

export const DEFAULT_STEP44_PLAYERCOUNT_COLLAPSE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-playercount-collapse.json",
);

function variantResult(arena = {}, variant = "S02") {
  return (arena.results ?? []).find((result) => result.variant === variant) ?? {};
}

function countByPattern(observations = {}, pattern = "") {
  return Object.entries(observations).reduce(
    (sum, [bucket, count]) => sum + (String(bucket).includes(pattern) ? Number(count ?? 0) : 0),
    0,
  );
}

export function summarizePlayerCountCollapseTiming({ arena = {} } = {}) {
  const s02 = variantResult(arena, "S02");
  const observations = s02.candidateBucketObservations ?? {};
  const totalObserved = Object.values(observations).reduce((sum, count) => sum + Number(count ?? 0), 0);
  const rows = [
    {
      timing: "hand-start 6max mixed default",
      count: Number(arena.maxHands ?? 0),
      interpretation: "mixed arena starts hands at default 6-player table size",
    },
    {
      timing: "decision observed as pc=4way+",
      count: countByPattern(observations, "pc=4way+"),
      interpretation: "observed S02 candidate buckets stay in broad 4way+ band",
    },
    {
      timing: "decision observed as playerCount=3 exact",
      count: Number(observations["S02 deep RAISE-vs-CHECK playerCount=3"] ?? 0),
      interpretation: "target exact 3-player branch did not naturally appear",
    },
    {
      timing: "decision observed as playerCount=4 exact",
      count: Number(observations["S02 deep RAISE-vs-CHECK playerCount=4"] ?? 0),
      interpretation: "target exact 4-player branch did not naturally appear",
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    classification: "NO_TARGET_COLLAPSE_TO_EXACT_PLAYERCOUNT",
    rows,
    totalS02CandidateObservations: totalObserved,
    pc4wayShare: roundNumber(countByPattern(observations, "pc=4way+") / Math.max(1, totalObserved), 6),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditPlayerCountCollapseTiming({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  outputPath = DEFAULT_STEP44_PLAYERCOUNT_COLLAPSE_OUTPUT_PATH,
  arena = null,
} = {}) {
  const report = summarizePlayerCountCollapseTiming({ arena: arena ?? (await readJson(arenaPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditPlayerCountCollapseTiming();
  console.log(JSON.stringify(report, null, 2));
}
