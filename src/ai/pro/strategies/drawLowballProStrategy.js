import { evaluateLowHand } from "../../../games/evaluators/low.js";
import {
  clampConfidence,
  getMaxDiscardCount,
  hasLegalAction,
  normalizeLegalActions,
  sanitizeDiscardIndexes,
} from "../strategyUtils.js";

function parseCardRank(card) {
  const label = String(card ?? "").trim().toUpperCase();
  const match = label.match(/^(10|[2-9AJQK])/);
  if (!match) return 99;
  switch (match[1]) {
    case "A":
      return 14;
    case "K":
      return 13;
    case "Q":
      return 12;
    case "J":
      return 11;
    default:
      return Number(match[1]);
  }
}

function parseCardSuit(card) {
  const label = String(card ?? "").trim().toUpperCase();
  const match = label.match(/(S|H|D|C)$/);
  return match?.[1] ?? "?";
}

function normalizeLowRank(card, lowType) {
  const rank = parseCardRank(card);
  if (lowType === "A5" && rank === 14) return 1;
  return rank;
}

function getWeakestIndexes(hand = [], keepIndexes = [], maxDiscardCount = 5, lowType = "27") {
  const keep = new Set(keepIndexes);
  return sanitizeDiscardIndexes(
    hand
      .map((card, index) => ({ index, rank: normalizeLowRank(card, lowType) }))
      .filter((entry) => !keep.has(entry.index))
      .sort((left, right) => right.rank - left.rank || right.index - left.index)
      .map((entry) => entry.index),
    maxDiscardCount,
    hand.length,
  );
}

function buildRankBuckets(hand = [], lowType) {
  const buckets = new Map();
  hand.forEach((card, index) => {
    const rank = normalizeLowRank(card, lowType);
    const list = buckets.get(rank) ?? [];
    list.push({ index, card, rank, suit: parseCardSuit(card) });
    buckets.set(rank, list);
  });
  return buckets;
}

function choosePairDiscardIndexes(hand = [], lowType, maxDiscardCount) {
  const buckets = buildRankBuckets(hand, lowType);
  const extras = [];
  [...buckets.entries()]
    .sort((left, right) => right[0] - left[0])
    .forEach(([, cards]) => {
      if (cards.length <= 1) return;
      cards
        .slice(1)
        .sort((left, right) => right.index - left.index)
        .forEach((entry) => extras.push(entry.index));
    });
  return sanitizeDiscardIndexes(extras, maxDiscardCount, hand.length);
}

function choosePenaltyBreakIndexes(hand = [], lowType, maxDiscardCount) {
  const ranked = hand
    .map((card, index) => ({
      index,
      rank: normalizeLowRank(card, lowType),
      suit: parseCardSuit(card),
    }))
    .sort((left, right) => right.rank - left.rank || right.index - left.index);

  const suitCounts = ranked.reduce((counts, entry) => {
    counts.set(entry.suit, (counts.get(entry.suit) ?? 0) + 1);
    return counts;
  }, new Map());
  const dominantSuit = [...suitCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const flushBreaker = dominantSuit
    ? ranked.find((entry) => entry.suit === dominantSuit)?.index
    : null;
  const highest = ranked[0]?.index ?? null;
  return sanitizeDiscardIndexes(
    [flushBreaker, highest].filter(Number.isInteger),
    Math.min(1, maxDiscardCount),
    hand.length,
  );
}

function chooseWeakHighCardDiscardIndexes(hand = [], lowType, maxDiscardCount, maxDrawRounds) {
  const ranked = hand
    .map((card, index) => ({
      index,
      rank: normalizeLowRank(card, lowType),
    }))
    .sort((left, right) => right.rank - left.rank || right.index - left.index)
    .map((entry) => entry.index);
  const preferredCount =
    maxDrawRounds === 1
      ? 1
      : lowType === "27"
        ? ranked.length >= 5
          ? 2
          : 1
        : ranked.length >= 5
          ? 2
          : 1;
  return sanitizeDiscardIndexes(
    ranked,
    Math.min(maxDiscardCount, preferredCount),
    hand.length,
  );
}

function chooseSingleDrawIndexes(hand = [], evaluation, lowType, maxDiscardCount, maxDrawRounds) {
  const ranks = evaluation?.metadata?.ranks ?? [];
  const patThreshold = lowType === "27" ? 8 : 6;
  const category = String(evaluation?.metadata?.category ?? "");
  const pairDiscard = choosePairDiscardIndexes(hand, lowType, maxDiscardCount);
  if (pairDiscard.length) {
    return pairDiscard;
  }

  if (lowType === "27" && ["straight", "flush", "straightFlush"].includes(category)) {
    const penaltyBreak = choosePenaltyBreakIndexes(hand, lowType, maxDiscardCount);
    if (penaltyBreak.length) {
      return penaltyBreak;
    }
  }

  if (ranks.length >= 5 && (ranks[0] ?? 99) <= patThreshold) {
    return [];
  }

  const bestCards = new Set((evaluation?.metadata?.cards ?? []).map(String));
  const discard = getWeakestIndexes(
    hand,
    hand
      .map((card, index) => (bestCards.has(String(card)) ? index : null))
      .filter(Number.isInteger),
    maxDiscardCount,
    lowType,
  );
  if (discard.length) {
    return discard;
  }
  return chooseWeakHighCardDiscardIndexes(hand, lowType, maxDiscardCount, maxDrawRounds);
}

function canSafelyValueRaise(snapshot = {}, legalActions = []) {
  if (!hasLegalAction(legalActions, "RAISE")) return false;
  const raiseCount = Number(snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound ?? 0) || 0;
  const raiseCap = Number(snapshot?.metadata?.raiseCap ?? snapshot?.raiseCap ?? 4) || 4;
  return raiseCount < raiseCap - 1;
}

function canOpenBet(legalActions = []) {
  return hasLegalAction(legalActions, "BET");
}

function getToCall(snapshot = {}, actor = null) {
  return Math.max(
    0,
    Number(
      snapshot?.toCall ??
        actor?.toCall ??
        ((snapshot?.currentBet ?? snapshot?.metadata?.currentBet ?? 0) -
          (actor?.betThisRound ?? actor?.betThisStreet ?? actor?.bet ?? 0)),
    ) || 0,
  );
}

function isPairedHand(hand = [], lowType = "27") {
  const ranks = hand.map((card) => normalizeLowRank(card, lowType));
  return new Set(ranks).size < ranks.length;
}

function getAggressionProfile(variantId = "", lowType = "27") {
  if (variantId === "D01") {
    return {
      valueRaiseHighRank: 7,
      valueBetHighRank: 8,
      callHighRank: 9,
    };
  }
  if (variantId === "D02") {
    return {
      valueRaiseHighRank: 5,
      valueBetHighRank: 6,
      callHighRank: 7,
    };
  }
  if (variantId === "S01") {
    return {
      valueRaiseHighRank: 7,
      valueBetHighRank: 8,
      callHighRank: 8,
    };
  }
  if (variantId === "S02") {
    return {
      valueRaiseHighRank: 5,
      valueBetHighRank: 6,
      callHighRank: 7,
    };
  }
  return {
    valueRaiseHighRank: lowType === "A5" ? 5 : 7,
    valueBetHighRank: lowType === "A5" ? 6 : 8,
    callHighRank: lowType === "A5" ? 7 : 9,
  };
}

function classifyLowballStrength({ highestRank = 99, cleanLow = false, lowType = "27" } = {}) {
  const premiumThreshold = lowType === "A5" ? 5 : 7;
  const strongThreshold = lowType === "A5" ? 6 : 8;
  const playableThreshold = lowType === "A5" ? 7 : 9;
  if (cleanLow && highestRank <= premiumThreshold) return "premium";
  if (cleanLow && highestRank <= strongThreshold) return "strong";
  if (highestRank <= playableThreshold) return "playable";
  return "weak";
}

function hasFlushPenalty(hand = [], lowType = "27") {
  if (lowType !== "27" || hand.length < 5) return false;
  const suits = hand.map((card) => parseCardSuit(card));
  return new Set(suits).size === 1;
}

function hasStraightPenalty(hand = [], lowType = "27") {
  if (lowType !== "27" || hand.length < 5) return false;
  const ranks = [...new Set(hand.map((card) => normalizeLowRank(card, lowType)))].sort((left, right) => left - right);
  if (ranks.length < 5) return false;
  return ranks.every((rank, index) => index === 0 || rank - ranks[index - 1] === 1);
}

function analyzeLowTexture({ ranks = [], lowType = "27" } = {}) {
  const ordered = [...ranks]
    .map((rank) => Number(rank) || 99)
    .sort((left, right) => left - right);
  const highest = ordered[ordered.length - 1] ?? 99;
  const secondHighest = ordered[ordered.length - 2] ?? 99;
  const largestGap = ordered.slice(1).reduce((gap, rank, index) => Math.max(gap, rank - ordered[index]), 0);
  const smoothThreshold = lowType === "A5" ? 2 : 2;
  const roughThreshold = lowType === "A5" ? 4 : 4;
  const smoothHigh = lowType === "A5" ? 7 : 8;
  const isSmooth =
    highest <= smoothHigh &&
    secondHighest <= (lowType === "A5" ? 5 : 6) &&
    largestGap <= smoothThreshold;
  const isRough =
    highest >= (lowType === "A5" ? 8 : 9) ||
    secondHighest >= (lowType === "A5" ? 6 : 7) ||
    largestGap >= roughThreshold;
  return {
    ordered,
    highest,
    secondHighest,
    largestGap,
    isSmooth,
    isRough,
  };
}

function isPenaltyHand({ lowType = "27", handCategory = "", cleanLow = false, hand = [] }) {
  if (lowType !== "27") return false;
  return (
    !cleanLow ||
    ["straight", "flush", "straightFlush"].includes(handCategory) ||
    hasFlushPenalty(hand, lowType) ||
    hasStraightPenalty(hand, lowType)
  );
}

function getWeakThreshold(lowType = "27") {
  return lowType === "A5" ? 8 : 9;
}

function chooseBettingFallback({
  legalActions = [],
  facingBet = false,
  foldReason = "pro-no-match-fold",
  callReason = "pro-no-match-call",
  checkReason = "pro-no-match-check",
} = {}) {
  const normalizedLegal = normalizeLegalActions(legalActions);
  if (!facingBet && normalizedLegal.some((entry) => entry.type === "CHECK")) {
    return { type: "CHECK", confidence: 0.58, reason: checkReason };
  }
  if (facingBet && normalizedLegal.some((entry) => entry.type === "CALL")) {
    return { type: "CALL", confidence: 0.56, reason: callReason };
  }
  if (normalizedLegal.some((entry) => entry.type === "FOLD")) {
    return { type: "FOLD", confidence: 0.62, reason: foldReason };
  }
  if (normalizedLegal.some((entry) => entry.type === "CHECK")) {
    return { type: "CHECK", confidence: 0.54, reason: checkReason };
  }
  if (normalizedLegal.some((entry) => entry.type === "CALL")) {
    return { type: "CALL", confidence: 0.52, reason: callReason };
  }
  return null;
}

export function chooseDrawLowballProStrategy({
  variantId = "",
  snapshot = {},
  legalActions = [],
  actor = null,
} = {}) {
  const hand = Array.isArray(actor?.hand) ? actor.hand : [];
  const maxDiscardCount = getMaxDiscardCount({ legalActions, hand });
  const lowType = ["D02", "S02"].includes(variantId) ? "A5" : "27";
  const evaluation = evaluateLowHand({ cards: hand, lowType });
  const highestRank = evaluation?.metadata?.ranks?.[0] ?? 99;
  const handCategory = String(evaluation?.metadata?.category ?? "");
  const cleanLow = Boolean(
    evaluation?.metadata?.isLow ??
      evaluation?.metadata?.qualifiesLow ??
      (lowType === "A5"
        ? ["highCard", "straight", "flush", "straightFlush"].includes(handCategory)
        : handCategory === "highCard"),
  );
  const drawRound = Number(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? 0) || 0;
  const maxDrawRounds =
    Number(snapshot?.maxDrawRounds ?? actor?.maxDrawRounds ?? (variantId.startsWith("S") ? 1 : 3)) || 3;
  const isDrawPhase = String(snapshot?.street ?? snapshot?.phase ?? "").toUpperCase() === "DRAW";
  const profile = getAggressionProfile(variantId, lowType);
  const lowTexture = analyzeLowTexture({
    ranks: evaluation?.metadata?.ranks ?? [],
    lowType,
  });
  const pairedHand = isPairedHand(hand, lowType);
  const toCall = getToCall(snapshot, actor);
  const facingBet = toCall > 0;
  const strength = classifyLowballStrength({ highestRank, cleanLow, lowType });
  const finalBettingRound = drawRound >= Math.max(1, maxDrawRounds);
  const expensiveCall = toCall >= Math.max(40, (actor?.stack ?? 0) * 0.2);
  const openBetLegal = canOpenBet(legalActions);
  const singleDraw = maxDrawRounds === 1;
  const penaltyHand = isPenaltyHand({ lowType, handCategory, cleanLow, hand });
  const weakThreshold = getWeakThreshold(lowType);
  const strongPat = cleanLow && highestRank <= profile.valueBetHighRank;
  const premiumPat = cleanLow && highestRank <= profile.valueRaiseHighRank;
  const weakFinalHand = pairedHand || penaltyHand || highestRank >= weakThreshold;
  const smoothMadeLow = cleanLow && lowTexture.isSmooth;
  const roughMadeLow = !pairedHand && cleanLow && lowTexture.isRough;
  const marginalMadeLow =
    cleanLow &&
    !pairedHand &&
    !premiumPat &&
    !smoothMadeLow &&
    highestRank <= weakThreshold;
  const openValueRaise =
    !facingBet &&
    !pairedHand &&
    ((variantId === "D01" && premiumPat) ||
      (variantId === "D02" && premiumPat) ||
      (variantId === "S02" && premiumPat));

  if (
    !facingBet &&
    !openBetLegal &&
    canSafelyValueRaise(snapshot, legalActions) &&
    (premiumPat || (singleDraw && strongPat) || ((variantId === "D02" || variantId === "S02") && strongPat))
  ) {
    return {
      type: "RAISE",
      confidence: 0.76,
      reason: `${variantId.toLowerCase()}-open-value-raise-no-bet-option`,
    };
  }

  if (isDrawPhase && hasLegalAction(legalActions, "DRAW")) {
    const discardIndexes = chooseSingleDrawIndexes(
      hand,
      evaluation,
      lowType,
      maxDiscardCount,
      maxDrawRounds,
    );
    if (discardIndexes.length === 0) {
      const patReason =
        lowType === "A5" && highestRank <= 5
          ? "wheel-or-strong-a5-pat"
          : highestRank <= 8
            ? "strong-low-pat"
            : "single-draw-pat";
      return {
        type: "DRAW",
        discardIndexes: [],
        confidence: clampConfidence(lowType === "A5" && highestRank <= 5 ? 0.97 : 0.9),
        reason: patReason,
      };
    }
    return {
      type: "DRAW",
      discardIndexes,
      confidence: clampConfidence(maxDrawRounds === 1 ? 0.83 : 0.78),
      reason: maxDrawRounds === 1 ? "single-draw-one-shot" : "lowball-improve-draw",
    };
  }

  if (singleDraw && finalBettingRound) {
    if (premiumPat && facingBet && canSafelyValueRaise(snapshot, legalActions)) {
      return {
        type: "RAISE",
        confidence: 0.78,
        reason: `${variantId.toLowerCase()}-single-draw-premium-value-raise`,
      };
    }
    if (!facingBet && openBetLegal && (premiumPat || smoothMadeLow)) {
      return {
        type: "BET",
        confidence: 0.74,
        reason: `${variantId.toLowerCase()}-single-draw-strong-value-bet`,
      };
    }
    if (!facingBet && (marginalMadeLow || roughMadeLow) && hasLegalAction(legalActions, "CHECK")) {
      return {
        type: "CHECK",
        confidence: 0.78,
        reason: `${variantId.toLowerCase()}-single-draw-marginal-check`,
      };
    }
    if (!facingBet && weakFinalHand && hasLegalAction(legalActions, "CHECK")) {
      return {
        type: "CHECK",
        confidence: 0.82,
        reason: `${variantId.toLowerCase()}-single-draw-final-check`,
      };
    }
    if (facingBet && weakFinalHand) {
      if ((expensiveCall || pairedHand || highestRank >= weakThreshold) && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.86,
          reason: `${variantId.toLowerCase()}-single-draw-final-fold`,
        };
      }
      if (!expensiveCall && (smoothMadeLow || premiumPat) && hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.68,
          reason: `${variantId.toLowerCase()}-single-draw-strong-defend-call`,
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: 0.6,
          reason: `${variantId.toLowerCase()}-single-draw-no-bluff-check`,
        };
      }
      return null;
    }
    if (!facingBet && !strongPat && hasLegalAction(legalActions, "CHECK")) {
      return {
        type: "CHECK",
        confidence: 0.72,
        reason: `${variantId.toLowerCase()}-single-draw-default-check`,
      };
    }
    if (facingBet && !expensiveCall && (smoothMadeLow || strongPat) && hasLegalAction(legalActions, "CALL")) {
      return {
        type: "CALL",
        confidence: 0.64,
        reason: `${variantId.toLowerCase()}-single-draw-default-call`,
      };
    }
    return null;
  }

  if (pairedHand && facingBet && finalBettingRound) {
    if (hasLegalAction(legalActions, "FOLD")) {
      return {
        type: "FOLD",
        confidence: 0.84,
        reason: `${variantId.toLowerCase()}-paired-final-fold`,
      };
    }
    const fallback = chooseBettingFallback({
      legalActions,
      facingBet,
      foldReason: `${variantId.toLowerCase()}-paired-final-fold`,
      callReason: `${variantId.toLowerCase()}-paired-final-call-last-resort`,
    });
    if (fallback) return fallback;
  }

  if (finalBettingRound && weakFinalHand) {
    if (!facingBet && hasLegalAction(legalActions, "CHECK")) {
      return {
        type: "CHECK",
        confidence: 0.84,
        reason: `${variantId.toLowerCase()}-final-round-weak-check`,
      };
    }
    if (facingBet && (expensiveCall || pairedHand || highestRank >= weakThreshold)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: `${variantId.toLowerCase()}-final-round-rough-fold`,
        };
      }
      if (hasLegalAction(legalActions, "CALL") && !expensiveCall && !pairedHand) {
        return {
          type: "CALL",
          confidence: 0.56,
          reason: `${variantId.toLowerCase()}-final-round-rough-call-last-resort`,
        };
      }
    }
  }

  if (finalBettingRound && cleanLow && highestRank === (lowType === "A5" ? 8 : 8) && !pairedHand) {
    if (!facingBet && openBetLegal && smoothMadeLow) {
      return {
        type: "BET",
        confidence: 0.72,
        reason: `${variantId.toLowerCase()}-smooth-low-final-value-bet`,
      };
    }
    if (facingBet && hasLegalAction(legalActions, "CALL") && !expensiveCall && !roughMadeLow) {
      return {
        type: "CALL",
        confidence: 0.64,
        reason: `${variantId.toLowerCase()}-smooth-low-final-call`,
      };
    }
  }

  if (penaltyHand && facingBet && (expensiveCall || finalBettingRound)) {
    if (hasLegalAction(legalActions, "FOLD")) {
      return {
        type: "FOLD",
        confidence: 0.8,
        reason: `${variantId.toLowerCase()}-penalty-hand-fold`,
      };
    }
    return null;
  }

  if (
    canSafelyValueRaise(snapshot, legalActions) &&
    ((strength === "premium" && !singleDraw) || openValueRaise) &&
    (!facingBet || !finalBettingRound || variantId === "D02" || variantId === "S02")
  ) {
    return {
      type: "RAISE",
      confidence: 0.78,
      reason: `${variantId.toLowerCase()}-premium-value-raise`,
    };
  }

  if (!facingBet && openBetLegal && strongPat && !singleDraw) {
    return {
      type: "BET",
      confidence: 0.72,
      reason: `${variantId.toLowerCase()}-strong-low-open-bet`,
    };
  }

  if (!facingBet && openBetLegal && finalBettingRound && smoothMadeLow && !singleDraw) {
    return {
      type: "BET",
      confidence: 0.7,
      reason: `${variantId.toLowerCase()}-smooth-low-open-bet`,
    };
  }

  if (facingBet) {
    if (premiumPat || (smoothMadeLow && !expensiveCall && !pairedHand && !penaltyHand)) {
      if (finalBettingRound && canSafelyValueRaise(snapshot, legalActions) && premiumPat) {
        return {
          type: "RAISE",
          confidence: 0.76,
          reason: `${variantId.toLowerCase()}-final-premium-value-raise`,
        };
      }
      if (hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.72,
          reason: `${variantId.toLowerCase()}-strong-low-defend-call`,
        };
      }
    }

    if (finalBettingRound && (strength === "weak" || pairedHand || expensiveCall || penaltyHand)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.8,
          reason: `${variantId.toLowerCase()}-final-round-spew-fold`,
        };
      }
      if (hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.52,
          reason: `${variantId.toLowerCase()}-final-round-call-last-resort`,
        };
      }
    }

    if (roughMadeLow && finalBettingRound && hasLegalAction(legalActions, "CALL") && !expensiveCall) {
      return {
        type: "CALL",
        confidence: 0.58,
        reason: `${variantId.toLowerCase()}-rough-low-bluff-catch-call`,
      };
    }

    if (strength === "playable" && !expensiveCall && !penaltyHand && hasLegalAction(legalActions, "CALL")) {
      return {
        type: "CALL",
        confidence: 0.62,
        reason: `${variantId.toLowerCase()}-playable-low-call`,
      };
    }

    return null;
  }

  if (!facingBet && hasLegalAction(legalActions, "CHECK")) {
    return {
      type: "CHECK",
      confidence: finalBettingRound && strength === "weak" ? 0.82 : 0.64,
      reason:
        finalBettingRound && strength === "weak"
          ? `${variantId.toLowerCase()}-final-round-check-back`
          : `${variantId.toLowerCase()}-default-check`,
    };
  }

  if (
    facingBet &&
    hasLegalAction(legalActions, "CALL") &&
    highestRank <= profile.callHighRank &&
    !expensiveCall &&
    !penaltyHand
  ) {
    return {
      type: "CALL",
      confidence: 0.58,
      reason: `${variantId.toLowerCase()}-default-call`,
    };
  }

  return null;
}
