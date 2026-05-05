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
  activeOpponents = 1,
  drawRound = 0,
  betRound = 0,
}) {
  const tier = context.tier ?? {};
  const tierId = tier.id ?? "standard";
  const eliteRank = tierId === "worldmaster" ? 3 : tierId === "iron" ? 2 : tierId === "pro" ? 1 : 0;
  const isWorld = tierId === "worldmaster";
  const isElite = eliteRank > 0;
  const raiseMultiplier = (tier.raiseSizeMultiplier ?? 1.1) * (isWorld ? 1.1 : isElite ? 1.04 : 1);
  const aggression = tier.aggression ?? 0.5;
  const bluffFreq = tier.bluffFrequency ?? 0.1;
  const eliteFoldDiscount = eliteRank * 0.015;
  const foldThreshold = Math.max(
    0.03,
    (tier.foldThreshold ?? 0.2) - (isWorld ? 0.02 : 0) - eliteFoldDiscount,
  );
  const raiseThreshold = clamp(
    (tier.raiseThreshold ?? 0.85) - (isWorld ? 0.05 : 0) - eliteRank * 0.025,
    0.55,
    0.95,
  );

  const liveOpponents = Math.max(1, Number(activeOpponents) || 1);
  const toCallUnits = betSize > 0 ? Math.max(0, Number(toCall) || 0) / betSize : 0;
  const multiwayPressure =
    liveOpponents >= 5 ? 0.26 : liveOpponents >= 4 ? 0.22 : liveOpponents >= 3 ? 0.14 : liveOpponents >= 2 ? 0.07 : 0;
  const lateStreetPressure = Math.max(0, Number(drawRound) || 0) >= 2 || Math.max(0, Number(betRound) || 0) >= 2 ? 0.08 : 0;
  const riskFactor = clamp((context.variant?.risk ?? 0.5) * 0.16, 0, 0.16);
  const raiseCutoff = clamp(raiseThreshold - aggression * 0.1, 0.6, 0.95);
  const lowballRanks = Array.isArray(evaluation?.ranks) ? evaluation.ranks : [];
  const highCard = lowballRanks.length ? Math.max(...lowballRanks) : 13;
  const lowRanks = lowballRanks.filter((rank) => rank <= 7).length;
  const isFinalBetRound =
    Math.max(0, Number(drawRound) || 0) >= 3 ||
    Math.max(0, Number(betRound) || 0) >= 3;
  const madeStrength =
    madeCards >= 4
      ? highCard <= 7
        ? 0.95
        : highCard <= 9
        ? 0.84
        : highCard <= 11
        ? 0.72
        : highCard <= 12
        ? 0.62
        : 0.54
      : madeCards === 3
      ? highCard <= 6
        ? 0.68
        : highCard <= 8
        ? 0.58
        : highCard <= 10
        ? 0.44
        : 0.34
      : madeCards === 2
      ? lowRanks >= 2
        ? 0.32
        : 0.22
      : 0.08;
  const drawPotentialCredit =
    madeCards === 3 && lowRanks >= 3
      ? 0.12
      : madeCards === 2 && lowRanks >= 2 && liveOpponents <= 2
      ? 0.08
      : 0;
  const eliteDrawCredit = isElite && madeCards === 3 && lowRanks >= 3 ? 0.04 + eliteRank * 0.02 : 0;
  const callPressure = clamp(toCallUnits * 0.08, 0, 0.24);
  const foldCutoff = clamp(
    foldThreshold +
      riskFactor +
      multiwayPressure +
      callPressure +
      lateStreetPressure -
      drawPotentialCredit -
      eliteDrawCredit,
    0.05,
    tierId === "beginner" ? 0.72 : 0.84,
  );

  const roll = Math.random();
  let action = toCall === 0 ? "CHECK" : "CALL";
  let decisionReason = "default";
  const strongFinalMadeBadugi =
    isFinalBetRound && madeCards >= 4 && highCard <= 7;

  if (canRaise && strongFinalMadeBadugi) {
    action = "RAISE";
    decisionReason = toCall > 0 ? "final-value-raise" : "final-value-bet";
  } else if (toCall > 0 && madeStrength < 0.35 && roll < foldCutoff) {
    action = "FOLD";
    decisionReason = liveOpponents >= 3 ? "weak-multiway-facing-bet" : "weak-facing-bet";
  } else if (toCall > 0 && liveOpponents >= 3 && madeStrength < 0.5 && roll < clamp(foldCutoff + 0.16, 0, 0.9)) {
    action = "FOLD";
    decisionReason = "marginal-multiway-facing-bet";
  } else if (toCall > 0 && liveOpponents >= 4 && madeStrength < 0.65 && roll < clamp(foldCutoff + 0.1, 0, 0.9)) {
    action = "FOLD";
    decisionReason = "rough-hand-crowded-pot";
  } else if (canRaise) {
    const valueRaise =
      madeStrength >= 0.9 ||
      (madeStrength >= 0.75 && roll > clamp(raiseCutoff - 0.08, 0.5, 0.95));
    const pressureRaise =
      madeStrength >= 0.55 && roll > raiseCutoff;
    const bluffRaise = toCall === 0 && madeStrength < 0.55 && roll > 1 - bluffFreq;
    const eliteThinValueRaise =
      isElite && toCall === 0 && madeStrength >= 0.72 && roll > clamp(0.72 - eliteRank * 0.07, 0.46, 0.72);
    const eliteSemiBluff =
      isElite &&
      toCall === 0 &&
      drawRound <= 1 &&
      madeCards === 3 &&
      lowRanks >= 3 &&
      roll > clamp(0.78 - eliteRank * 0.08, 0.52, 0.78);
    const elitePunishCall =
      isElite && toCall > 0 && madeStrength >= 0.84 && roll > clamp(0.62 - eliteRank * 0.07, 0.38, 0.7);
    if (valueRaise || pressureRaise || bluffRaise || eliteThinValueRaise || eliteSemiBluff || elitePunishCall) {
      action = "RAISE";
      decisionReason = valueRaise
        ? "value"
        : eliteThinValueRaise
        ? "thin-value"
        : elitePunishCall
        ? "value-punish-call"
        : eliteSemiBluff
        ? "semi-bluff"
        : pressureRaise
        ? "pressure"
        : "bluff";
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
    tierId,
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
