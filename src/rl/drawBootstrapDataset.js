import {
  buildDrawObservationPayload,
  buildDrawObservationVector,
  wrapRuleBasedDrawDecision,
} from "./drawObservationSchema.js";

function actionLabel(decision = {}) {
  if (decision.type === "DRAW") {
    return `draw_${decision.discardIndexes?.length ?? decision.metadata?.drawCount ?? 0}`;
  }
  return String(decision.type ?? "").toLowerCase();
}

export function buildDrawBootstrapExample({ engine, state, seatIndex, legalActions = [] } = {}) {
  const decision = wrapRuleBasedDrawDecision({ engine, state, seatIndex });
  if (!decision) return null;
  const variantId = engine?.variantId ?? state?.metadata?.variantId ?? null;
  const observation = buildDrawObservationPayload({ state, seatIndex, variantId, legalActions });
  return {
    schema_version: observation.schemaVersion,
    variant_id: variantId,
    source: "rule-based-bootstrap",
    observation: buildDrawObservationVector(observation),
    action: actionLabel(decision),
    legal_actions: [...legalActions],
    metadata: {
      strategy: decision.metadata?.strategy ?? null,
      drawCount: decision.metadata?.drawCount ?? decision.discardIndexes?.length ?? null,
      discardIndexes: Array.isArray(decision.discardIndexes) ? [...decision.discardIndexes] : [],
    },
  };
}

export function buildDrawBootstrapDataset(examples = []) {
  const records = examples.map(buildDrawBootstrapExample).filter(Boolean);
  return {
    schema_version: "draw-observation-v1",
    format: "supervised-bootstrap",
    count: records.length,
    records,
  };
}
