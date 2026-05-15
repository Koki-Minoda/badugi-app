import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { DEFAULT_STEP43_MIXED_ARENA_PATH } from "./auditMixedExposureHits.js";

export const DEFAULT_STEP44_TARGETED_MIXED_DIVERGENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-targeted-mixed-divergence.json",
);

function variantResult(arena = {}, variant = "S02") {
  return (arena.results ?? []).find((result) => result.variant === variant) ?? {};
}

function targetCount(result = {}) {
  const buckets = result.bucketHitDistribution ?? {};
  const observations = result.candidateBucketObservations ?? {};
  return {
    hits:
      Number(buckets["S02 deep RAISE-vs-CHECK playerCount=3"] ?? 0) +
      Number(buckets["S02 deep RAISE-vs-CHECK playerCount=4"] ?? 0),
    opportunities:
      Number(observations["S02 deep RAISE-vs-CHECK playerCount=3"] ?? 0) +
      Number(observations["S02 deep RAISE-vs-CHECK playerCount=4"] ?? 0),
  };
}

export function summarizeTargetedMixedDivergence({ targetedArena = {}, mixedArena = {}, repeatability = {} } = {}) {
  const targeted = targetCount(variantResult(targetedArena, "S02"));
  const mixed = targetCount(variantResult(mixedArena, "S02"));
  const repeatableMean = Number(repeatability.metrics?.exactHits?.mean ?? 0);
  const rows = [
    {
      dimension: "targetedSampling",
      targeted: Boolean(targetedArena.targetedSampling),
      mixed: Boolean(mixedArena.targetedSampling),
      divergence: "enabled-vs-disabled",
    },
    {
      dimension: "targetBucket",
      targeted: targetedArena.targetBucket ?? null,
      mixed: mixedArena.targetBucket ?? null,
      divergence: targetedArena.targetBucket === mixedArena.targetBucket ? "same" : "targeted-only",
    },
    {
      dimension: "exactOpportunities",
      targeted: targeted.opportunities,
      mixed: mixed.opportunities,
      divergence: targeted.opportunities - mixed.opportunities,
    },
    {
      dimension: "exactHits",
      targeted: targeted.hits,
      mixed: mixed.hits,
      divergence: targeted.hits - mixed.hits,
    },
    {
      dimension: "repeatabilityMeanExactHits",
      targeted: roundNumber(repeatableMean, 4),
      mixed: mixed.hits,
      divergence: roundNumber(repeatableMean - mixed.hits, 4),
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    rows,
    divergenceSource: mixed.opportunities === 0 && targeted.hits > 0 ? "targeted-table-size-exposure-absent-in-mixed" : "partial",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditTargetedMixedDivergence({
  targetedArenaPath = path.resolve("reports/ai-iron/iron-step41-targeted-smoke-arena.json"),
  mixedArenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  repeatabilityPath = path.resolve("reports/ai-iron/step42-repeatability-summary.json"),
  outputPath = DEFAULT_STEP44_TARGETED_MIXED_DIVERGENCE_OUTPUT_PATH,
  targetedArena = null,
  mixedArena = null,
  repeatability = null,
} = {}) {
  const report = summarizeTargetedMixedDivergence({
    targetedArena: targetedArena ?? (await readJson(targetedArenaPath)),
    mixedArena: mixedArena ?? (await readJson(mixedArenaPath)),
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditTargetedMixedDivergence();
  console.log(JSON.stringify(report, null, 2));
}
