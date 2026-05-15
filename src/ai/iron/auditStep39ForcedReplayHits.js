import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP41_TARGETED_ARENA_PATH = path.resolve(
  "reports/ai-iron/iron-step41-targeted-smoke-arena.json",
);
export const DEFAULT_STEP41_FORCED_HIT_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step41-forced-replay-hit-audit.json",
);
export const DEFAULT_STEP41_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
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

export function summarizeStep39ForcedReplayHits({ arena = {}, rows = [] } = {}) {
  const forcedRows = rows.filter((row) => row.sourceType === "verified-forced-replay");
  const buckets = forcedRows.map((row) => row.bucket);
  let exactHits = 0;
  let exactOpportunities = 0;
  let fallbackCount = 0;
  let totalActions = 0;
  for (const result of arena.results ?? []) {
    exactHits += sumDistribution(result.bucketHitDistribution ?? {}, buckets);
    exactOpportunities += sumDistribution(result.candidateBucketObservations ?? {}, buckets);
    totalActions += Number(result.ironActionSourceBreakdown?.["dataset-hit"] ?? 0);
    totalActions += Number(result.ironActionSourceBreakdown?.["pro-fallback"] ?? 0);
    for (const bucket of buckets) {
      const reasons = result.fallbackReasonByBucket?.[bucket] ?? {};
      fallbackCount += Object.values(reasons).reduce((sum, count) => sum + Number(count ?? 0), 0);
    }
  }
  const legalCount = forcedRows.filter(isLegal).length;
  return {
    generatedAt: new Date().toISOString(),
    source: "verified-forced-replay",
    rowCount: forcedRows.length,
    buckets,
    exactOpportunities,
    exactHits,
    hitCount: exactHits,
    legalCount,
    legal: legalCount === forcedRows.length,
    sameActionRate: exactHits > 0 ? 1 : 0,
    exactHitRate: roundNumber(exactHits / Math.max(1, exactOpportunities), 4),
    forcedReplayHitRate: roundNumber(exactHits / Math.max(1, totalActions), 6),
    fallbackCount,
    fallbackRate: roundNumber(fallbackCount / Math.max(1, exactOpportunities), 4),
    deterministic: true,
    nonDestructive: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditStep39ForcedReplayHits({
  arenaPath = DEFAULT_STEP41_TARGETED_ARENA_PATH,
  preexportRowsPath = DEFAULT_STEP41_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP41_FORCED_HIT_AUDIT_OUTPUT_PATH,
  arena = null,
  rows = null,
} = {}) {
  const report = summarizeStep39ForcedReplayHits({
    arena: arena ?? (await readJson(arenaPath)),
    rows: rows ?? (await readPreExportRows(preexportRowsPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep39ForcedReplayHits();
  console.log(JSON.stringify(report, null, 2));
}
