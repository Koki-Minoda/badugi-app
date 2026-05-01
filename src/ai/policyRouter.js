import { getVariantById } from "../games/config/variantCatalog.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseBadugiRank(card) {
  const label = String(card ?? "").trim().toUpperCase();
  const match = label.match(/^(10|[2-9AJQK])/);
  if (!match) return 13;
  switch (match[1]) {
    case "A":
      return 1;
    case "J":
      return 11;
    case "Q":
      return 12;
    case "K":
      return 13;
    default:
      return Number(match[1]);
  }
}

function getDeadCardLabels(evaluation) {
  const deadCards =
    evaluation?.deadCards ??
    evaluation?.metadata?.deadCards ??
    evaluation?.discardCards ??
    [];
  return Array.isArray(deadCards) ? deadCards.map((card) => String(card)) : [];
}

function chooseDiscardIndexes({ hand = [], evaluation, drawCount = 0 }) {
  if (!Array.isArray(hand) || drawCount <= 0) return [];
  const selected = [];
  const usedIndexes = new Set();
  const deadLabels = getDeadCardLabels(evaluation);

  deadLabels.forEach((label) => {
    if (selected.length >= drawCount) return;
    const index = hand.findIndex(
      (card, idx) => !usedIndexes.has(idx) && String(card) === String(label),
    );
    if (index >= 0) {
      selected.push(index);
      usedIndexes.add(index);
    }
  });

  if (selected.length < drawCount) {
    const candidates = hand
      .map((card, index) => ({ card, index, rank: parseBadugiRank(card) }))
      .filter((entry) => !usedIndexes.has(entry.index))
      .sort((a, b) => b.rank - a.rank || b.index - a.index);
    candidates.some((entry) => {
      if (selected.length >= drawCount) return true;
      selected.push(entry.index);
      usedIndexes.add(entry.index);
      return false;
    });
  }

  return selected.sort((a, b) => a - b);
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
  evaluation,
}) {
  const tier = context.tier ?? {};
  const isWorld = tier.id === "worldmaster";
  const raiseMultiplier = (tier.raiseSizeMultiplier ?? 1.1) * (isWorld ? 1.1 : 1);
  const aggression = tier.aggression ?? 0.5;
  const bluffFreq = tier.bluffFrequency ?? 0.1;
  const foldThreshold = Math.max(0.03, (tier.foldThreshold ?? 0.2) - (isWorld ? 0.02 : 0));
  const raiseThreshold = clamp((tier.raiseThreshold ?? 0.85) - (isWorld ? 0.05 : 0), 0.55, 0.95);

  const riskFactor = clamp((context.variant?.risk ?? 0.5) * 0.2, 0, 0.2);
  const foldCutoff = clamp(foldThreshold + riskFactor, 0.05, 0.4);
  const raiseCutoff = clamp(raiseThreshold - aggression * 0.1, 0.6, 0.95);
  const lowballRanks = Array.isArray(evaluation?.ranks) ? evaluation.ranks : [];
  const highCard = lowballRanks.length ? Math.max(...lowballRanks) : 13;
  const madeStrength =
    madeCards >= 4
      ? highCard <= 7
        ? 0.95
        : 0.82
      : madeCards === 3
      ? highCard <= 8
        ? 0.62
        : 0.48
      : madeCards === 2
      ? 0.28
      : 0.08;

  const roll = Math.random();
  let action = toCall === 0 ? "CHECK" : "CALL";
  let decisionReason = "default";

  if (toCall > 0 && madeStrength < 0.35 && roll < foldCutoff) {
    action = "FOLD";
    decisionReason = "weak-facing-bet";
  } else if (canRaise) {
    const valueRaise =
      madeStrength >= 0.9 ||
      (madeStrength >= 0.75 && roll > clamp(raiseCutoff - 0.08, 0.5, 0.95));
    const pressureRaise =
      madeStrength >= 0.55 && roll > raiseCutoff;
    const bluffRaise = toCall === 0 && madeStrength < 0.55 && roll > 1 - bluffFreq;
    if (valueRaise || pressureRaise || bluffRaise) {
      action = "RAISE";
      decisionReason = valueRaise ? "value" : pressureRaise ? "pressure" : "bluff";
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
    tierId: tier.id,
    reason: decisionReason,
  };
}

export function computeDrawDecision({ context, evaluation, hand = [] }) {
  const baseRanks = evaluation?.ranks ?? [];
  const defaultDraws = baseRanks.length <= 1 ? 3 : baseRanks.length === 2 ? 2 : baseRanks.length === 3 ? 1 : 0;
  const bias = context.tier?.drawAggression ?? 0;
  const roll = Math.random();
  let drawCount = defaultDraws;
  if (bias > 0 && roll < Math.min(1, bias)) {
    drawCount = Math.min(3, drawCount + 1);
  }
  const discardIndexes = chooseDiscardIndexes({ hand, evaluation, drawCount });
  return {
    drawCount,
    discardIndexes,
    source: "policy-router",
    tierId: context.tier?.id,
  };
}
