import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP43_MIXED_ARENA_PATH = path.resolve("reports/ai-iron/iron-step43-mixed-arena.json");
export const DEFAULT_STEP43_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP43_MIXED_HIT_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-mixed-hit-audit.json",
);

function actionType(action = null) {
  return String(action?.type ?? action ?? "").toUpperCase();
}

function sumDistribution(distribution = {}, keys = []) {
  return keys.reduce((sum, key) => sum + Number(distribution[key] ?? 0), 0);
}

function isLegal(row = {}) {
  const chosen = actionType(row.chosenBestAction);
  return (row.legalActions ?? []).some((action) => actionType(action) === chosen);
}

function bucketFallbackCount(result = {}, bucket = "") {
  const reasons = result.fallbackReasonByBucket?.[bucket] ?? {};
  return Object.values(reasons).reduce((sum, count) => sum + Number(count ?? 0), 0);
}

export function summarizeMixedExposureHits({ arena = {}, rows = [] } = {}) {
  const forcedRows = rows.filter((row) => row.sourceType === "verified-forced-replay");
  const buckets = forcedRows.map((row) => row.bucket);
  const byPlayerCount = forcedRows.map((row) => {
    const bucket = row.bucket;
    let opportunities = 0;
    let hits = 0;
    let fallback = 0;
    for (const result of arena.results ?? []) {
      opportunities += Number(result.candidateBucketObservations?.[bucket] ?? 0);
      hits += Number(result.bucketHitDistribution?.[bucket] ?? 0);
      fallback += bucketFallbackCount(result, bucket);
    }
    return {
      playerCount: Number(row.playerCount ?? row.metadata?.playerCount ?? 0),
      bucket,
      opportunities,
      hits,
      exactHitRate: roundNumber(hits / Math.max(1, opportunities), 4),
      fallback,
      legal: isLegal(row),
    };
  });
  const exactOpportunities = byPlayerCount.reduce((sum, entry) => sum + entry.opportunities, 0);
  const exactHits = byPlayerCount.reduce((sum, entry) => sum + entry.hits, 0);
  const fallbackCount = byPlayerCount.reduce((sum, entry) => sum + entry.fallback, 0);
  const legalCount = forcedRows.filter(isLegal).length;
  return {
    generatedAt: new Date().toISOString(),
    arenaId: arena.arenaId ?? null,
    datasetPath: arena.datasetPath ?? null,
    source: "verified-forced-replay",
    rowCount: forcedRows.length,
    buckets,
    exactOpportunities,
    exactHits,
    hitCount: exactHits,
    exactHitRate: roundNumber(exactHits / Math.max(1, exactOpportunities), 4),
    legalCount,
    legal: legalCount === forcedRows.length,
    fallbackCount,
    fallbackRate: roundNumber(fallbackCount / Math.max(1, exactOpportunities), 4),
    byPlayerCount,
    mixedExposureMaintained: exactOpportunities > 0 && exactHits > 0,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditMixedExposureHits({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  preexportRowsPath = DEFAULT_STEP43_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP43_MIXED_HIT_AUDIT_OUTPUT_PATH,
  arena = null,
  rows = null,
} = {}) {
  const report = summarizeMixedExposureHits({
    arena: arena ?? (await readJson(arenaPath)),
    rows: rows ?? (await readPreExportRows(preexportRowsPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditMixedExposureHits();
  console.log(JSON.stringify(report, null, 2));
}
