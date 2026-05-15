import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";
import { DEFAULT_STEP43_MIXED_ARENA_PATH } from "./auditMixedExposureHits.js";

export const DEFAULT_STEP44_TABLE_EXPOSURE_OUTPUT_PATH = path.resolve("reports/ai-iron/step44-table-exposure.json");

function variantResult(arena = {}, variant = "S02") {
  return (arena.results ?? []).find((result) => result.variant === variant) ?? {};
}

function sumMatching(observations = {}, predicate = () => false) {
  return Object.entries(observations).reduce(
    (sum, [bucket, count]) => sum + (predicate(bucket) ? Number(count ?? 0) : 0),
    0,
  );
}

export function summarizeTableSizeExposureMechanics({ mixedArena = {}, targetedSummary = {} } = {}) {
  const observations = variantResult(mixedArena, "S02").candidateBucketObservations ?? {};
  const targetedExact =
    Number(targetedSummary.metrics?.exactOpportunities?.mean ?? 0) * Number((targetedSummary.runs ?? []).length || 0);
  const rows = [
    {
      tableType: "6max-start mixed",
      exactOpportunities: 0,
      observedCandidates: sumMatching(observations, () => true),
      note: "mixed arena default starts at 6 players; target exact rows did not surface",
    },
    {
      tableType: "4way+ observed band",
      exactOpportunities: 0,
      observedCandidates: sumMatching(observations, (bucket) => String(bucket).includes("pc=4way+")),
      note: "candidate observations remain in broad 4way+ buckets, not exact playerCount=3/4 target rows",
    },
    {
      tableType: "targeted 3way/4way exposure",
      exactOpportunities: targetedExact,
      observedCandidates: targetedExact,
      note: "targeted repeatability proves the rows are reachable when the table-size exposure is present",
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    rows,
    diagnosis: targetedExact > 0 ? "table-size exposure drives target opportunity recovery" : "targeted-baseline-missing",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditTableSizeExposureMechanics({
  mixedArenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  targetedSummaryPath = path.resolve("reports/ai-iron/step42-repeatability-summary.json"),
  outputPath = DEFAULT_STEP44_TABLE_EXPOSURE_OUTPUT_PATH,
  mixedArena = null,
  targetedSummary = null,
} = {}) {
  const report = summarizeTableSizeExposureMechanics({
    mixedArena: mixedArena ?? (await readJson(mixedArenaPath)),
    targetedSummary: targetedSummary ?? (await readJson(targetedSummaryPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditTableSizeExposureMechanics();
  console.log(JSON.stringify(report, null, 2));
}
