import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { DEFAULT_STEP43_MIXED_ARENA_PATH } from "./auditMixedExposureHits.js";

export const STEP44_TARGET_BUCKETS = [
  "S02 deep RAISE-vs-CHECK playerCount=3",
  "S02 deep RAISE-vs-CHECK playerCount=4",
];
export const DEFAULT_STEP44_OPPORTUNITY_FUNNEL_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-opportunity-funnel.json",
);

function variantResult(arena = {}, variant = "S02") {
  return (arena.results ?? []).find((result) => result.variant === variant) ?? {};
}

function sumObjectValues(object = {}) {
  return Object.values(object).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function sumBuckets(distribution = {}, buckets = STEP44_TARGET_BUCKETS) {
  return buckets.reduce((sum, bucket) => sum + Number(distribution?.[bucket] ?? 0), 0);
}

function countKeysContaining(object = {}, text = "") {
  return Object.entries(object).reduce(
    (sum, [key, value]) => sum + (String(key).includes(text) ? Number(value ?? 0) : 0),
    0,
  );
}

export function summarizeMixedOpportunityFunnels({ arena = {} } = {}) {
  const s02 = variantResult(arena, "S02");
  const sourceBreakdown = s02.ironActionSourceBreakdown ?? {};
  const totalIronDecisions =
    Number(sourceBreakdown["dataset-hit"] ?? 0) + Number(sourceBreakdown["pro-fallback"] ?? 0);
  const observations = s02.candidateBucketObservations ?? {};
  const hits = s02.bucketHitDistribution ?? {};
  const targetObserved = sumBuckets(observations);
  const targetHits = sumBuckets(hits);
  const stages = [
    { stage: "S02 iron decisions", remaining: totalIronDecisions },
    { stage: "S02 candidate bucket observations", remaining: sumObjectValues(observations) },
    { stage: "S02 4way+ observed candidates", remaining: countKeysContaining(observations, "pc=4way+") },
    { stage: "S02 deep RAISE-vs-CHECK family observed", remaining: countKeysContaining(observations, "S02 deep RAISE-vs-CHECK") },
    { stage: "playerCount=3 exact opportunities", remaining: Number(observations[STEP44_TARGET_BUCKETS[0]] ?? 0) },
    { stage: "playerCount=4 exact opportunities", remaining: Number(observations[STEP44_TARGET_BUCKETS[1]] ?? 0) },
    { stage: "verified-forced-replay exact opportunities", remaining: targetObserved },
    { stage: "verified-forced-replay exact hits", remaining: targetHits },
  ];
  const disappearanceStage =
    targetObserved === 0
      ? "S02 deep RAISE-vs-CHECK family observed"
      : targetHits === 0
        ? "verified-forced-replay exact hits"
        : "not-disappeared";
  return {
    generatedAt: new Date().toISOString(),
    arenaId: arena.arenaId ?? null,
    target: "S02 deep RAISE-vs-CHECK",
    stages,
    disappearanceStage,
    exactOpportunities: targetObserved,
    exactHits: targetHits,
    datasetHitRate: roundNumber(s02.datasetHitRate, 6),
    proFallbackRate: roundNumber(s02.proFallbackRate ?? s02.fallback, 6),
    note: "mixed arena aggregate observations show S02 coverage, but no S02 deep RAISE-vs-CHECK target family observations",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditMixedOpportunityFunnels({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  outputPath = DEFAULT_STEP44_OPPORTUNITY_FUNNEL_OUTPUT_PATH,
  arena = null,
} = {}) {
  const report = summarizeMixedOpportunityFunnels({ arena: arena ?? (await readJson(arenaPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditMixedOpportunityFunnels();
  console.log(JSON.stringify(report, null, 2));
}
