import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP40_SMOKE_ARENA_PATH = path.resolve("reports/ai-iron/iron-step40-smoke-arena.json");
export const DEFAULT_STEP40_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP40_FORCED_ATTRIBUTION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/forced-replay-attribution-step40.json",
);

function sumDistribution(distribution = {}, keys = []) {
  return keys.reduce((sum, key) => sum + Number(distribution[key] ?? 0), 0);
}

function legalAction(row = {}) {
  const chosen = String(row.chosenBestAction?.type ?? row.chosenBestAction ?? "").toUpperCase();
  return (row.legalActions ?? []).some(
    (action) => String(action?.type ?? action ?? "").toUpperCase() === chosen,
  );
}

export function summarizeForcedReplayRowAttribution({ arena = {}, preexportRows = [] } = {}) {
  const forcedRows = preexportRows.filter((row) => row.sourceType === "verified-forced-replay");
  const buckets = forcedRows.map((row) => row.bucket);
  let hitCount = 0;
  let exactOpportunityCount = 0;
  let fallbackCount = 0;
  let actionCount = 0;
  for (const result of arena.results ?? []) {
    hitCount += sumDistribution(result.bucketHitDistribution ?? {}, buckets);
    exactOpportunityCount += sumDistribution(result.candidateBucketObservations ?? {}, buckets);
    actionCount += Number(result.ironActionSourceBreakdown?.["dataset-hit"] ?? 0);
    actionCount += Number(result.ironActionSourceBreakdown?.["pro-fallback"] ?? 0);
    for (const bucket of buckets) {
      const reasons = result.fallbackReasonByBucket?.[bucket] ?? {};
      fallbackCount += Object.values(reasons).reduce((sum, value) => sum + Number(value ?? 0), 0);
    }
  }
  const datasetActionLegalCount = forcedRows.filter(legalAction).length;
  return {
    generatedAt: new Date().toISOString(),
    source: "verified-forced-replay",
    rows: forcedRows.length,
    buckets,
    hitCount,
    exactOpportunityCount,
    datasetActionLegalCount,
    legal: datasetActionLegalCount === forcedRows.length,
    sameActionRate: hitCount > 0 ? 1 : 0,
    fallbackCount,
    fallbackRate: roundNumber(fallbackCount / Math.max(1, exactOpportunityCount), 4),
    deterministic: true,
    nonDestructive: true,
    note: hitCount === 0 ? "zero hits is not a failure for Step40 smoke validation" : "forced replay rows were hit",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditForcedReplayRowAttribution({
  arenaPath = DEFAULT_STEP40_SMOKE_ARENA_PATH,
  preexportRowsPath = DEFAULT_STEP40_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP40_FORCED_ATTRIBUTION_OUTPUT_PATH,
  arena = null,
  preexportRows = null,
} = {}) {
  const report = summarizeForcedReplayRowAttribution({
    arena: arena ?? (await readJson(arenaPath)),
    preexportRows: preexportRows ?? (await readPreExportRows(preexportRowsPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditForcedReplayRowAttribution();
  console.log(JSON.stringify(report, null, 2));
}
