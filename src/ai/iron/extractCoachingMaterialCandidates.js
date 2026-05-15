import fs from "node:fs/promises";
import path from "node:path";

import { STEP42_TARGET_BUCKETS } from "./aggregateStep42Repeatability.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP46_COACHING_CANDIDATES_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step46-coaching-material-candidates.jsonl",
);

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function lessonTagFor(row = {}) {
  const chosen = actionType(row.chosenBestAction);
  const rejected = actionType(row.rejectedAction);
  if (chosen === "RAISE" && rejected === "CHECK") return "missed-value";
  if (chosen === "CALL" && rejected === "FOLD") return "too-tight";
  return "better-action-selection";
}

function explanationFor({ chosen = "", rejected = "", playerCount = 0 } = {}) {
  if (chosen === "RAISE" && rejected === "CHECK") {
    return `深いスタックで強いSDA5を持つ${playerCount}人局面では、チェックで回すよりレイズで価値を取りに行く方が期待値が高い可能性があります。`;
  }
  return `同じ局面では${rejected}より${chosen}を選ぶ方が期待値を改善できる可能性があります。`;
}

function rowByBucket(rows = []) {
  return new Map(rows.map((row) => [String(row.bucket ?? ""), row]));
}

export function extractCoachingMaterialCandidateRows({ arenas = [], rows = [] } = {}) {
  const byBucket = rowByBucket(rows.filter((row) => row.sourceType === "verified-forced-replay"));
  const totals = new Map();
  for (const arena of arenas) {
    const s02 = (arena.results ?? []).find((result) => result.variant === "S02") ?? {};
    for (const bucket of STEP42_TARGET_BUCKETS) {
      const hits = Number(s02.bucketHitDistribution?.[bucket] ?? 0);
      if (hits <= 0) continue;
      const current = totals.get(bucket) ?? { hits: 0, opportunities: 0 };
      current.hits += hits;
      current.opportunities += Number(s02.candidateBucketObservations?.[bucket] ?? 0);
      totals.set(bucket, current);
    }
  }
  return [...totals.entries()]
    .map(([bucket, totalsForBucket]) => {
      const row = byBucket.get(bucket) ?? {};
      const ironAction = actionType(row.chosenBestAction);
      const proAction = actionType(row.rejectedAction);
      const playerCount = Number(row.playerCount ?? row.metadata?.playerCount ?? 0);
      const estimatedEVGain = Number(row.forcedReplay?.meanDelta ?? 0);
      return {
        variantId: "S02",
        spot: "deep RAISE-vs-CHECK",
        bucket,
        playerCount,
        ironAction,
        proAction,
        estimatedEVGain,
        lessonTag: lessonTagFor(row),
        exactHits: totalsForBucket.hits,
        exactOpportunities: totalsForBucket.opportunities,
        legal: true,
        deterministic: true,
        replayAvailable: true,
        sourceType: row.sourceType ?? "verified-forced-replay",
        jpExplanationDraft: explanationFor({ chosen: ironAction, rejected: proAction, playerCount }),
        promoted: false,
        routingChanged: false,
        priorityFrozen: true,
        d01Excluded: true,
      };
    })
    .filter((candidate) => candidate.ironAction && candidate.proAction && candidate.ironAction !== candidate.proAction)
    .filter((candidate) => candidate.estimatedEVGain > 0 && candidate.exactHits > 0);
}

export async function extractCoachingMaterialCandidates({
  arenaPaths = ["a", "b", "c"].map((run) => path.resolve(`reports/ai-iron/iron-step46-natural-repeat-${run}.json`)),
  preexportRowsPath = path.resolve("reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl"),
  outputPath = DEFAULT_STEP46_COACHING_CANDIDATES_OUTPUT_PATH,
  arenas = null,
  rows = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map(async (arenaPath) => JSON.parse(await fs.readFile(arenaPath, "utf8")))));
  const loadedRows = rows ?? (await readPreExportRows(preexportRowsPath));
  const candidates = extractCoachingMaterialCandidateRows({ arenas: loadedArenas, rows: loadedRows });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, candidates.map((row) => JSON.stringify(row)).join("\n") + (candidates.length ? "\n" : ""), "utf8");
  return {
    outputPath,
    candidateCount: candidates.length,
    candidates,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await extractCoachingMaterialCandidates();
  console.log(JSON.stringify({ ...report, candidates: undefined }, null, 2));
}
