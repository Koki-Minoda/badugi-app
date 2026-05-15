import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP40_ARENA_PATH = path.resolve("reports/ai-iron/iron-step40-smoke-arena.json");
export const DEFAULT_STEP41_ARENA_PATH = path.resolve("reports/ai-iron/iron-step41-targeted-smoke-arena.json");
export const DEFAULT_STEP40_FORCED_ATTRIBUTION_PATH = path.resolve(
  "reports/ai-iron/forced-replay-attribution-step40.json",
);
export const DEFAULT_STEP41_FORCED_HIT_AUDIT_PATH = path.resolve(
  "reports/ai-iron/step41-forced-replay-hit-audit.json",
);
export const DEFAULT_STEP41_EXPOSURE_GAIN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step41-practical-exposure-gain.json",
);

function variantResult(arena = {}, variant = "S02") {
  return (arena.results ?? []).find((result) => result.variant === variant) ?? {};
}

function exposureSnapshot({ arena = {}, forced = {}, variant = "S02" } = {}) {
  const result = variantResult(arena, variant);
  const exactOpportunities = Number(forced.exactOpportunities ?? forced.exactOpportunityCount ?? 0);
  const hits = Number(forced.exactHits ?? forced.hitCount ?? 0);
  return {
    variant,
    datasetHitRate: roundNumber(result.datasetHitRate, 6),
    exactOpportunityRate: roundNumber(exactOpportunities / Math.max(1, Number(result.ironActionSourceBreakdown?.["dataset-hit"] ?? 0) + Number(result.ironActionSourceBreakdown?.["pro-fallback"] ?? 0)), 6),
    forcedReplayHitRate: roundNumber(forced.forcedReplayHitRate ?? hits / Math.max(1, exactOpportunities), 6),
    exactOpportunities,
    exactHits: hits,
    ironProGap: roundNumber(result.ironProGap, 4),
    fallbackRate: roundNumber(result.proFallbackRate ?? result.fallback, 6),
  };
}

export function summarizePracticalExposureGain({ step40Arena = {}, step41Arena = {}, step40Forced = {}, step41Forced = {} } = {}) {
  const before = exposureSnapshot({ arena: step40Arena, forced: step40Forced });
  const after = exposureSnapshot({ arena: step41Arena, forced: step41Forced });
  return {
    generatedAt: new Date().toISOString(),
    comparison: "Step40 vs Step41",
    before,
    after,
    gains: {
      datasetHitRateDelta: roundNumber(after.datasetHitRate - before.datasetHitRate, 6),
      exactOpportunityDelta: after.exactOpportunities - before.exactOpportunities,
      forcedReplayHitDelta: after.exactHits - before.exactHits,
      ironProGapDelta: roundNumber(after.ironProGap - before.ironProGap, 4),
      fallbackRateDelta: roundNumber(after.fallbackRate - before.fallbackRate, 6),
    },
    successMinimumMet: after.exactOpportunities > 0,
    successIdealMet: after.exactHits > 0 && after.datasetHitRate > before.datasetHitRate && after.ironProGap > 0,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function evaluatePracticalExposureGain({
  step40ArenaPath = DEFAULT_STEP40_ARENA_PATH,
  step41ArenaPath = DEFAULT_STEP41_ARENA_PATH,
  step40ForcedPath = DEFAULT_STEP40_FORCED_ATTRIBUTION_PATH,
  step41ForcedPath = DEFAULT_STEP41_FORCED_HIT_AUDIT_PATH,
  outputPath = DEFAULT_STEP41_EXPOSURE_GAIN_OUTPUT_PATH,
  step40Arena = null,
  step41Arena = null,
  step40Forced = null,
  step41Forced = null,
} = {}) {
  const report = summarizePracticalExposureGain({
    step40Arena: step40Arena ?? (await readJson(step40ArenaPath)),
    step41Arena: step41Arena ?? (await readJson(step41ArenaPath)),
    step40Forced: step40Forced ?? (await readJson(step40ForcedPath)),
    step41Forced: step41Forced ?? (await readJson(step41ForcedPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await evaluatePracticalExposureGain();
  console.log(JSON.stringify(report, null, 2));
}
