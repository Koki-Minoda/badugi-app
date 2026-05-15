function roundNumber(value, digits = 2) {
  return Number(Number(value ?? 0).toFixed(digits));
}

export function analyzeIronDatasetHits({
  arenaId = "iron-step9",
  datasetPath = "",
  results = [],
  promoted = false,
  routingChanged = false,
} = {}) {
  const variantSummaries = (Array.isArray(results) ? results : []).map((result) => ({
    variant: result.variant,
    ironEv: roundNumber(result.ironEv, 2),
    proEv: roundNumber(result.proEv, 2),
    standardEv: roundNumber(result.standardEv, 2),
    datasetHitRate: roundNumber(result.datasetHitRate, 4),
    proFallbackRate: roundNumber(result.proFallbackRate, 4),
    ironEVWhenHit: roundNumber(result.ironEVWhenHit, 2),
    proFallbackEV: roundNumber(result.proFallbackEV, 2),
    hitHands: Number(result.hitHands ?? 0),
    fallbackOnlyHands: Number(result.fallbackOnlyHands ?? 0),
    bucketAttribution: Array.isArray(result.bucketAttribution)
      ? result.bucketAttribution.map((entry) => ({
          variant: result.variant,
          bucket: entry.bucket,
          hits: Number(entry.hits ?? 0),
          handHits: Number(entry.handHits ?? 0),
          hitRate: roundNumber(entry.hitRate, 4),
          ironEVWhenHit: roundNumber(entry.ironEVWhenHit, 2),
          proFallbackEV: roundNumber(entry.proFallbackEV, 2),
          impact: roundNumber(entry.impact, 2),
        }))
      : [],
    sourceTypeAttribution: Array.isArray(result.sourceTypeAttribution)
      ? result.sourceTypeAttribution.map((entry) => ({
          variant: result.variant,
          sourceType: entry.sourceType,
          hits: Number(entry.hits ?? 0),
          handHits: Number(entry.handHits ?? 0),
          hitRate: roundNumber(entry.hitRate, 4),
          ironEVWhenHit: roundNumber(entry.ironEVWhenHit, 2),
          proFallbackEV: roundNumber(entry.proFallbackEV, 2),
          impact: roundNumber(entry.impact, 2),
        }))
      : [],
    targetBucketProfile: result.targetBucketProfile
        ? {
          targetBucket: result.targetBucketProfile.targetBucket,
          exactOpportunities: Number(result.targetBucketProfile.exactOpportunities ?? 0),
          nearOpportunities: Number(result.targetBucketProfile.nearOpportunities ?? 0),
          datasetActionLegalCount: Number(result.targetBucketProfile.datasetActionLegalCount ?? 0),
          finalDatasetHits: Number(result.targetBucketProfile.finalDatasetHits ?? 0),
          nearMisses: Number(result.targetBucketProfile.nearMisses ?? 0),
          mismatchReasons: result.targetBucketProfile.mismatchReasons ?? {},
        }
      : null,
  }));

  return {
    arenaId,
    datasetPath,
    promoted: Boolean(promoted),
    routingChanged: Boolean(routingChanged),
    variants: variantSummaries,
  };
}
