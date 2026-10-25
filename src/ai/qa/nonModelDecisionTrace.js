// A deliberately selected rule policy is different from a failed model call.
export function buildNonModelDecisionTrace({variantId, tierId, phase, reason, startedAt}) {
  return {
    variantId, tierId, phase,
    requestedModelId: null, selectedModelId: null, usedModelId: null,
    status: 'not-connected', reason,
    elapsedMs: Math.max(0, Date.now() - startedAt),
  };
}
