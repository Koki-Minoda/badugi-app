import { getVariantById } from "../../games/config/variantCatalog.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildAiContext({ variantId, tierConfig, opponentStats }) {
  const variant = getVariantById(variantId) ?? {};
  return {
    variant,
    tier: tierConfig,
    opponent: opponentStats,
  };
}

export function computeBetDecision({
  context,
  toCall = 0,
  canRaise = true,
  madeCards = 0,
  betSize = 20,
  actor,
}) {
  const tier = context.tier;
  const isWorld = tier.id === "worldmaster";
  const raiseMultiplier = (tier.raiseSizeMultiplier ?? 1.1) * (isWorld ? 1.1 : 1);
  const aggression = tier.aggression ?? 0.5;
  const bluffFreq = tier.bluffFrequency ?? 0.1;
  const foldThreshold = Math.max(0.03, (tier.foldThreshold ?? 0.2) - (isWorld ? 0.02 : 0));
  const raiseThreshold = clamp((tier.raiseThreshold ?? 0.85) - (isWorld ? 0.05 : 0), 0.55, 0.95);

  const riskFactor = clamp((context.variant?.risk ?? 0.5) * 0.2, 0, 0.2);
  const foldCutoff = clamp(foldThreshold + riskFactor, 0.05, 0.4);
  const raiseCutoff = clamp(raiseThreshold - aggression * 0.1, 0.6, 0.95);

  const roll = Math.random();
  let action = toCall === 0 ? "CHECK" : "CALL";

  if (toCall > 0 && roll < foldCutoff && madeCards < 3) {
    action = "FOLD";
  } else if (canRaise) {
    if (roll > raiseCutoff || (toCall === 0 && roll > 1 - bluffFreq)) {
      action = "RAISE";
    }
  }

  let raiseSize = betSize;
  if (action === "RAISE") {
    raiseSize = Math.round(betSize * raiseMultiplier);
    if (actor?.stack) {
      raiseSize = Math.min(actor.stack + (actor.betThisRound ?? 0), Math.max(betSize, raiseSize));
    }
  }

  return {
    action,
    raiseSize,
    source: "policy-router",
  };
}

export function computeDrawDecision({ context, evaluation }) {
  const baseRanks = evaluation?.ranks ?? [];
  const defaultDraws = baseRanks.length <= 1 ? 3 : baseRanks.length === 2 ? 2 : baseRanks.length === 3 ? 1 : 0;
  const bias = context.tier?.drawAggression ?? 0;
  const roll = Math.random();
  let drawCount = defaultDraws;
  if (bias < 0 && roll < Math.min(1, Math.abs(bias))) {
    drawCount = Math.min(3, drawCount + 1);
  } else if (bias > 0 && roll < Math.min(1, bias) && drawCount > 0) {
    drawCount = Math.max(0, drawCount - 1);
  }
  return {
    drawCount,
    source: "policy-router",
  };
}
