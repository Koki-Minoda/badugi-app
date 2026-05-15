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

function getSnapshotPotSize(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return Math.max(0, snapshot.pot);
  if (Array.isArray(snapshot?.pots) && snapshot.pots.length) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0), 0);
  }
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const currentBet = Number(snapshot?.currentBet ?? snapshot?.metadata?.currentBet ?? 0) || 0;
  if (!players.length || currentBet <= 0) return 0;
  return currentBet * players.length;
}

function classifyBetSizeBucket(toCall = 0, potSize = 0) {
  const normalizedPot = Math.max(1, potSize);
  const ratio = toCall / normalizedPot;
  if (ratio > 1 || ratio > 0.5) return "large";
  if (ratio > 0.2) return "medium";
  return "small";
}

function countLivePlayers(snapshot = {}) {
  return (snapshot?.players ?? []).filter(
    (player) =>
      player &&
      !player.folded &&
      !player.hasFolded &&
      !player.seatOut &&
      !player.sittingOut &&
      !player.busted &&
      !player.isBusted,
  ).length;
}

function getActiveOpponentCount(snapshot = {}, actor = null) {
  const livePlayers = countLivePlayers(snapshot);
  if (
    actor &&
    !actor.folded &&
    !actor.hasFolded &&
    !actor.seatOut &&
    !actor.sittingOut &&
    !actor.busted &&
    !actor.isBusted
  ) {
    return Math.max(0, livePlayers - 1);
  }
  return Math.max(0, livePlayers);
}

function isMultiwayPot(snapshot = {}, actor = null) {
  return getActiveOpponentCount(snapshot, actor) >= 2;
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

function classifyA5Hand({
  cleanLow = false,
  highestRank = 99,
  pairedHand = false,
  lowTexture = {},
} = {}) {
  if (pairedHand || !cleanLow) {
    if (highestRank >= 10 || pairedHand) return "trashA5";
    return "weakA5";
  }
  if (highestRank <= 6) return "premiumA5";
  if (highestRank === 7 && lowTexture.isSmooth) return "strongA5";
  if ((highestRank === 7 && !lowTexture.isRough) || (highestRank === 8 && lowTexture.isSmooth)) {
    return "mediumA5";
  }
  if (highestRank <= 9) return "weakA5";
  return "trashA5";
}

function classifySingleDrawFinalHand({
  lowType = "27",
  cleanLow = false,
  pairedHand = false,
  highestRank = 99,
  smoothMadeLow = false,
  premiumPat = false,
  strongPat = false,
} = {}) {
  if (pairedHand || !cleanLow) return "weak";
  if (premiumPat) return "premium";
  if (smoothMadeLow) return "strong";
  const mediumThreshold = lowType === "A5" ? 8 : 8;
  if (strongPat || highestRank <= mediumThreshold) return "medium";
  return "weak";
}

function classifyA5SingleDrawHand({
  cleanLow = false,
  pairedHand = false,
  highestRank = 99,
} = {}) {
  if (pairedHand) return "trashSDA5";
  if (!cleanLow) {
    return highestRank >= 10 ? "trashSDA5" : "weakSDA5";
  }
  if (highestRank <= 6) return "premiumSDA5";
  if (highestRank === 7) return "strongSDA5";
  if (highestRank === 8) return "mediumSDA5";
  if (highestRank <= 10) return "weakSDA5";
  return "trashSDA5";
}

function classifyA5SingleDrawDetail({
  cleanLow = false,
  pairedHand = false,
  highestRank = 99,
  lowTexture = {},
} = {}) {
  const a5SingleDrawClass = classifyA5SingleDrawHand({
    cleanLow,
    pairedHand,
    highestRank,
  });
  const ordered = Array.isArray(lowTexture?.ordered) ? lowTexture.ordered : [];
  const secondHighest = lowTexture?.secondHighest ?? ordered[ordered.length - 2] ?? 99;
  const thirdHighest = ordered[ordered.length - 3] ?? 99;
  const upperStrongSDA5 =
    a5SingleDrawClass === "strongSDA5" &&
    secondHighest <= 5 &&
    thirdHighest <= 4 &&
    (lowTexture.largestGap ?? 99) <= 2;
  const upperMediumSDA5 =
    a5SingleDrawClass === "mediumSDA5" &&
    secondHighest <= 6 &&
    thirdHighest <= 5;
  const lowerMediumSDA5 = a5SingleDrawClass === "mediumSDA5" && !upperMediumSDA5;
  const weakNineOrTLow = a5SingleDrawClass === "weakSDA5" && highestRank <= 10;
  return {
    a5SingleDrawClass,
    upperStrongSDA5,
    upperMediumSDA5,
    lowerMediumSDA5,
    weakNineOrTLow,
  };
}

function classify27SingleDrawHand({
  cleanLow = false,
  pairedHand = false,
  penaltyHand = false,
  highestRank = 99,
  lowTexture = {},
} = {}) {
  const smoothNine =
    highestRank === 9 && (lowTexture.secondHighest ?? 99) <= 7 && (lowTexture.largestGap ?? 99) <= 2;
  if (pairedHand || penaltyHand) return "trashSD27";
  if (!cleanLow) {
    return highestRank >= 11 ? "trashSD27" : "weakSD27";
  }
  if (highestRank <= 7) return "premiumSD27";
  if (highestRank === 8 && lowTexture.isSmooth) return "premiumSD27";
  if (highestRank === 8) return "strongSD27";
  if (smoothNine) return "strongSD27";
  if (highestRank <= 10) return "mediumSD27";
  return "weakSD27";
}

function classify27SingleDrawDetail({
  cleanLow = false,
  pairedHand = false,
  penaltyHand = false,
  highestRank = 99,
  lowTexture = {},
} = {}) {
  const sd27Class = classify27SingleDrawHand({
    cleanLow,
    pairedHand,
    penaltyHand,
    highestRank,
    lowTexture,
  });
  const ordered = Array.isArray(lowTexture?.ordered) ? lowTexture.ordered : [];
  const secondHighest = lowTexture?.secondHighest ?? ordered[ordered.length - 2] ?? 99;
  const thirdHighest = ordered[ordered.length - 3] ?? 99;
  const smoothNine =
    highestRank === 9 &&
    secondHighest <= 7 &&
    thirdHighest === 6 &&
    (lowTexture.largestGap ?? 99) <= 2;
  const roughEightUpper = highestRank === 8 && secondHighest <= 7 && thirdHighest <= 5;
  const upperRough9 =
    highestRank === 9 &&
    !smoothNine &&
    secondHighest <= 7 &&
    thirdHighest <= 5 &&
    !penaltyHand &&
    !pairedHand &&
    cleanLow;
  const lowerRough9 = highestRank === 9 && sd27Class === "mediumSD27" && !upperRough9;
  return {
    sd27Class,
    smoothNine,
    roughEightUpper,
    upperStrongSD27: roughEightUpper || smoothNine,
    upperRough9SD27: upperRough9,
    lowerRough9SD27: lowerRough9,
    upperMediumSD27: upperRough9,
    lowerMediumSD27: sd27Class === "mediumSD27" && !upperRough9,
    tlowSD27: highestRank === 10 && sd27Class === "mediumSD27",
  };
}

function classify27TripleDrawHand({
  cleanLow = false,
  pairedHand = false,
  penaltyHand = false,
  highestRank = 99,
  lowTexture = {},
} = {}) {
  const smoothEight = highestRank === 8 && lowTexture.isSmooth && (lowTexture.secondHighest ?? 99) <= 6;
  const smoothNine =
    highestRank === 9 &&
    (lowTexture.secondHighest ?? 99) <= 7 &&
    (lowTexture.largestGap ?? 99) <= 2;
  if (pairedHand || penaltyHand) return "trash27TD";
  if (!cleanLow) {
    return highestRank >= 11 ? "trash27TD" : "weak27TD";
  }
  if (highestRank <= 7 || smoothEight) return "premium27TD";
  if (highestRank === 8 || smoothNine) return "strong27TD";
  if (highestRank <= 10) return "medium27TD";
  return "weak27TD";
}

function classify27TripleDrawDetail({
  cleanLow = false,
  pairedHand = false,
  penaltyHand = false,
  highestRank = 99,
  lowTexture = {},
} = {}) {
  const td27Class = classify27TripleDrawHand({
    cleanLow,
    pairedHand,
    penaltyHand,
    highestRank,
    lowTexture,
  });
  const ordered = Array.isArray(lowTexture?.ordered) ? lowTexture.ordered : [];
  const secondHighest = lowTexture?.secondHighest ?? ordered[ordered.length - 2] ?? 99;
  const thirdHighest = ordered[ordered.length - 3] ?? 99;
  const smoothEightPremium = highestRank === 8 && lowTexture.isSmooth && secondHighest <= 6;
  const roughEightTD = highestRank === 8 && td27Class === "strong27TD" && !smoothEightPremium;
  const smoothNineUpper =
    highestRank === 9 &&
    td27Class === "strong27TD" &&
    secondHighest <= 7 &&
    thirdHighest <= 6 &&
    (lowTexture.largestGap ?? 99) <= 2;
  const upperRough9TD =
    highestRank === 9 &&
    td27Class === "medium27TD" &&
    secondHighest <= 7 &&
    thirdHighest <= 5;
  const lowerRough9TD = highestRank === 9 && td27Class === "medium27TD" && !upperRough9TD;
  const tlowTD = highestRank === 10 && td27Class === "medium27TD";
  return {
    td27Class,
    smoothEightPremium,
    roughEightTD,
    smoothNineUpper,
    upperStrong27TD: roughEightTD || smoothNineUpper,
    upperRough9TD,
    lowerRough9TD,
    tlowTD,
  };
}

function chooseA5DrawDiscardIndexes({
  hand = [],
  evaluation,
  highestRank = 99,
  maxDiscardCount = 5,
  maxDrawRounds = 3,
  drawRound = 0,
  pairedHand = false,
  a5Class = "weakA5",
} = {}) {
  const pairDiscard = choosePairDiscardIndexes(hand, "A5", maxDiscardCount);
  if (pairDiscard.length) {
    return pairDiscard;
  }

  if (highestRank <= 5) return [];
  if (a5Class === "premiumA5" || a5Class === "strongA5") return [];

  const finalDraw = drawRound >= Math.max(2, maxDrawRounds - 1);
  if (finalDraw && a5Class !== "trashA5") {
    return [];
  }

  const keepCards = new Set((evaluation?.metadata?.cards ?? []).map(String));
  const bestDiscard = getWeakestIndexes(
    hand,
    hand
      .map((card, index) => (keepCards.has(String(card)) ? index : null))
      .filter(Number.isInteger),
    maxDiscardCount,
    "A5",
  );
  if (bestDiscard.length) {
    return sanitizeDiscardIndexes(
      bestDiscard,
      Math.min(maxDiscardCount, a5Class === "trashA5" || pairedHand ? 2 : 1),
      hand.length,
    );
  }

  return chooseWeakHighCardDiscardIndexes(
    hand,
    "A5",
    Math.min(maxDiscardCount, a5Class === "trashA5" || pairedHand ? 2 : 1),
    maxDrawRounds,
  );
}

function chooseSingleDrawFinalBettingAction({
  variantId = "",
  snapshot = {},
  lowType = "27",
  singleDrawClass = "weak",
  a5SingleDrawClass = "",
  a5SingleDrawDetail = {},
  sd27Class = "",
  legalActions = [],
  facingBet = false,
  facingRaise = false,
  expensiveCall = false,
  premiumPat = false,
  smoothMadeLow = false,
  betSizeBucket = "small",
  toCall = 0,
  drawRound = 0,
  highestRank = 99,
  lowTexture = {},
  penaltyHand = false,
  sd27Detail = {},
} = {}) {
  const label = variantId.toLowerCase();
  const smallCall = betSizeBucket === "small" && toCall <= 20;
  const mediumCall = betSizeBucket === "medium" && toCall <= 20;
  const largePressure = expensiveCall || betSizeBucket === "large";
  const livePlayers = countLivePlayers(snapshot);
  const headsUp = livePlayers <= 2;

  if (variantId === "S01") {
    if (!facingBet) {
      if (sd27Class === "premiumSD27") {
        if (canOpenBet(legalActions)) {
          return {
            type: "BET",
            confidence: 0.82,
            reason: "s01-premium-sd-final-value-bet",
          };
        }
        if (hasLegalAction(legalActions, "RAISE")) {
          return {
            type: "RAISE",
            confidence: 0.76,
            reason: "s01-premium-sd-open-raise-no-bet-option",
          };
        }
      }
      if (sd27Class === "strongSD27") {
        if (canOpenBet(legalActions)) {
          return {
            type: "BET",
            confidence: sd27Detail.upperStrongSD27 ? 0.78 : 0.74,
            reason: sd27Detail.upperStrongSD27
              ? "s01-strong-sd-upper-final-value-bet"
              : "s01-strong-sd-final-value-bet",
          };
        }
      }
      if (sd27Detail.upperRough9SD27 && canOpenBet(legalActions)) {
        return {
          type: "BET",
          confidence: 0.68,
          reason: "s01-upper-rough9-sd-thin-value-bet",
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence:
            sd27Class === "mediumSD27" ? 0.74 : ["weakSD27", "trashSD27"].includes(sd27Class) ? 0.84 : 0.66,
          reason:
            sd27Class === "mediumSD27"
              ? "s01-medium-sd-check"
              : sd27Class === "weakSD27"
                ? "s01-weak-sd-check"
                : sd27Class === "trashSD27"
                  ? "s01-trash-sd-check"
                  : "s01-check-only",
        };
      }
      return null;
    }

    if (sd27Class === "premiumSD27") {
      if (canSafelyValueRaise(snapshot, legalActions) && !largePressure) {
        return {
          type: "RAISE",
          confidence: 0.8,
          reason: "s01-premium-sd-final-value-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.72,
          reason: largePressure ? "s01-premium-sd-large-call" : "s01-premium-sd-defend-call",
        };
      }
    }

    if (sd27Class === "strongSD27") {
      const ordered = Array.isArray(lowTexture?.ordered) ? lowTexture.ordered : [];
      const smoothNine =
        highestRank === 9 &&
        (lowTexture.secondHighest ?? ordered[ordered.length - 2] ?? 99) <= 7 &&
        (ordered[ordered.length - 3] ?? 99) === 6 &&
        (lowTexture.largestGap ?? 99) <= 2;
      const topStrongMadeLow = highestRank <= 8 || smoothNine;
      const thinRaiseCandidate =
        sd27Detail.roughEightUpper && smallCall && canSafelyValueRaise(snapshot, legalActions) && !largePressure;
      if (thinRaiseCandidate) {
        return {
          type: "RAISE",
          confidence: 0.71,
          reason: "s01-strong-upper-thin-value-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && smallCall) {
        return {
          type: "CALL",
          confidence: topStrongMadeLow ? 0.7 : 0.66,
          reason: "s01-strong-sd-small-call",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && mediumCall && topStrongMadeLow && !penaltyHand) {
        return {
          type: "CALL",
          confidence: 0.64,
          reason: "s01-strong-sd-medium-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: largePressure ? "s01-strong-sd-large-pressure-fold" : "s01-strong-sd-fold",
        };
      }
    }

    if (sd27Class === "mediumSD27") {
      if (sd27Detail.upperRough9SD27 && hasLegalAction(legalActions, "CALL") && smallCall) {
        return {
          type: "CALL",
          confidence: 0.58,
          reason: "s01-upper-rough9-sd-small-call",
        };
      }
      const bottomEdgeMedium =
        highestRank >= 10 || penaltyHand || sd27Detail.lowerRough9SD27 || sd27Detail.tlowSD27;
      if (hasLegalAction(legalActions, "CALL") && smallCall && !bottomEdgeMedium && highestRank <= 9) {
        return {
          type: "CALL",
          confidence: 0.56,
          reason: "s01-medium-sd-small-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.84,
          reason: sd27Detail.upperRough9SD27
            ? "s01-upper-rough9-sd-pressure-fold"
            : sd27Detail.lowerRough9SD27
              ? "s01-lower-rough9-sd-fold"
              : sd27Detail.tlowSD27
                ? "s01-tlow-sd-fold"
                : "s01-medium-sd-pressure-fold",
        };
      }
    }

    if (["weakSD27", "trashSD27"].includes(sd27Class)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.86,
          reason: sd27Class === "weakSD27" ? "s01-weak-sd-fold" : "s01-trash-sd-fold",
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: 0.66,
          reason: sd27Class === "weakSD27" ? "s01-weak-sd-check-last-resort" : "s01-trash-sd-check-last-resort",
        };
      }
    }
  }

  if (variantId === "S02") {
    if (!facingBet) {
      if (a5SingleDrawClass === "premiumSDA5") {
        if (canOpenBet(legalActions)) {
          return {
            type: "BET",
            confidence: 0.82,
            reason: "s02-premium-sd-final-value-bet",
          };
        }
        if (hasLegalAction(legalActions, "RAISE")) {
          return {
            type: "RAISE",
            confidence: 0.78,
            reason: "s02-premium-sd-open-raise-no-bet-option",
          };
        }
        if (hasLegalAction(legalActions, "CHECK")) {
          return {
            type: "CHECK",
            confidence: 0.66,
            reason: "s02-premium-sd-check-only",
          };
        }
      }
      if (a5SingleDrawClass === "strongSDA5") {
        if (canOpenBet(legalActions)) {
          return {
            type: "BET",
            confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.79 : 0.76,
            reason: a5SingleDrawDetail.upperStrongSDA5
              ? "s02-strong-upper-sd-final-value-bet"
              : "s02-strong-sd-final-value-bet",
          };
        }
        if (hasLegalAction(legalActions, "CHECK")) {
          return {
            type: "CHECK",
            confidence: 0.68,
            reason: "s02-strong-sd-check-only",
          };
        }
      }
      if (a5SingleDrawDetail.upperMediumSDA5 && headsUp && canOpenBet(legalActions)) {
        return {
          type: "BET",
          confidence: 0.66,
          reason: "s02-upper-medium-sd-heads-up-thin-value-bet",
        };
      }
      if (["mediumSDA5", "weakSDA5", "trashSDA5"].includes(a5SingleDrawClass) && hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence:
            a5SingleDrawClass === "mediumSDA5"
              ? a5SingleDrawDetail.upperMediumSDA5
                ? 0.7
                : 0.78
              : 0.84,
          reason:
            a5SingleDrawClass === "mediumSDA5"
              ? a5SingleDrawDetail.upperMediumSDA5
                ? "s02-upper-medium-sd-check"
                : "s02-lower-medium-sd-check"
              : a5SingleDrawClass === "weakSDA5"
                ? "s02-weak-sd-check"
                : "s02-trash-sd-check",
        };
      }
      return null;
    }

    if (a5SingleDrawClass === "premiumSDA5") {
      if (
        hasLegalAction(legalActions, "RAISE") &&
        !largePressure &&
        (smallCall || (mediumCall && headsUp)) &&
        (!facingRaise || headsUp)
      ) {
        return {
          type: "RAISE",
          confidence: smallCall ? 0.81 : 0.75,
          reason: smallCall ? "s02-premium-sd-small-value-raise" : "s02-premium-sd-medium-value-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: largePressure ? 0.62 : 0.74,
          reason: largePressure ? "s02-premium-sd-large-call" : "s02-premium-sd-defend-call",
        };
      }
    }

    if (a5SingleDrawClass === "strongSDA5") {
      if (
        a5SingleDrawDetail.upperStrongSDA5 &&
        (smallCall || (mediumCall && headsUp)) &&
        hasLegalAction(legalActions, "RAISE") &&
        (headsUp || livePlayers === 3) &&
        !facingRaise &&
        !largePressure
      ) {
        return {
          type: "RAISE",
          confidence: smallCall ? 0.72 : 0.68,
          reason: smallCall ? "s02-strong-upper-sd-thin-value-raise" : "s02-strong-upper-sd-medium-thin-value-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && smallCall) {
        return {
          type: "CALL",
          confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.72 : 0.69,
          reason: "s02-strong-sd-small-call",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && mediumCall) {
        return {
          type: "CALL",
          confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.67 : 0.64,
          reason: "s02-strong-sd-medium-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: largePressure ? "s02-strong-sd-large-pressure-fold" : "s02-strong-sd-fold",
        };
      }
    }

    if (a5SingleDrawClass === "mediumSDA5") {
      if (a5SingleDrawDetail.upperMediumSDA5 && hasLegalAction(legalActions, "CALL") && smallCall) {
        return {
          type: "CALL",
          confidence: 0.58,
          reason: "s02-upper-medium-sd-small-call",
        };
      }
      if (
        a5SingleDrawDetail.lowerMediumSDA5 &&
        hasLegalAction(legalActions, "CALL") &&
        smallCall &&
        toCall <= 5
      ) {
        return {
          type: "CALL",
          confidence: 0.52,
          reason: "s02-lower-medium-sd-min-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.84,
          reason: a5SingleDrawDetail.upperMediumSDA5
            ? "s02-upper-medium-sd-pressure-fold"
            : "s02-lower-medium-sd-fold",
        };
      }
    }

    if (["weakSDA5", "trashSDA5"].includes(a5SingleDrawClass)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.86,
          reason: a5SingleDrawClass === "weakSDA5" ? "s02-weak-sd-fold" : "s02-trash-sd-fold",
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: 0.66,
          reason: a5SingleDrawClass === "weakSDA5" ? "s02-weak-sd-check-last-resort" : "s02-trash-sd-check-last-resort",
        };
      }
    }
  }

  if (!facingBet) {
    if (["premium", "strong"].includes(singleDrawClass) && canOpenBet(legalActions)) {
      return {
        type: "BET",
        confidence: singleDrawClass === "premium" ? 0.78 : 0.74,
        reason:
          singleDrawClass === "premium"
            ? `${label}-single-draw-premium-value-bet`
            : `${label}-single-draw-strong-value-bet`,
      };
    }
    if (hasLegalAction(legalActions, "CHECK")) {
      return {
        type: "CHECK",
        confidence: singleDrawClass === "weak" ? 0.82 : 0.72,
        reason:
          singleDrawClass === "weak"
            ? `${label}-single-draw-final-check`
            : `${label}-single-draw-medium-check`,
      };
    }
    if (singleDrawClass === "premium" && hasLegalAction(legalActions, "RAISE") && !canOpenBet(legalActions)) {
      return {
        type: "RAISE",
        confidence: 0.76,
        reason: `${label}-single-draw-open-premium-raise`,
      };
    }
    return null;
  }

  if (singleDrawClass === "premium") {
    if (premiumPat && canSafelyValueRaise({}, legalActions)) {
      return {
        type: "RAISE",
        confidence: 0.78,
        reason: `${label}-single-draw-premium-value-raise`,
      };
    }
    if (hasLegalAction(legalActions, "CALL") && !expensiveCall) {
      return {
        type: "CALL",
        confidence: 0.72,
        reason: `${label}-single-draw-premium-defend-call`,
      };
    }
  }

  if (singleDrawClass === "strong") {
    if (hasLegalAction(legalActions, "CALL") && !expensiveCall && betSizeBucket !== "large") {
      return {
        type: "CALL",
        confidence: smoothMadeLow ? 0.68 : 0.64,
        reason: `${label}-single-draw-strong-defend-call`,
      };
    }
  }

  if (singleDrawClass === "medium") {
    if (hasLegalAction(legalActions, "CALL") && !expensiveCall && betSizeBucket === "small") {
      return {
        type: "CALL",
        confidence: 0.6,
        reason: `${label}-single-draw-medium-call`,
      };
    }
  }

  if (hasLegalAction(legalActions, "FOLD")) {
    return {
      type: "FOLD",
      confidence: 0.84,
      reason: `${label}-single-draw-final-fold`,
    };
  }

  if (hasLegalAction(legalActions, "CHECK")) {
    return {
      type: "CHECK",
      confidence: 0.6,
      reason: `${label}-single-draw-no-bluff-check`,
    };
  }

  return null;
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
  const potSize = getSnapshotPotSize(snapshot);
  const betSizeBucket = classifyBetSizeBucket(toCall, potSize);
  const facingBet = toCall > 0;
  const raiseCountThisRound = Number(snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound ?? 0) || 0;
  const facingRaise = facingBet && raiseCountThisRound > 0;
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
    (premiumPat || ((variantId === "D02" || variantId === "S02") && strongPat))
  ) {
    return {
      type: "RAISE",
      confidence: 0.76,
      reason: `${variantId.toLowerCase()}-open-value-raise-no-bet-option`,
    };
  }

  if (isDrawPhase && hasLegalAction(legalActions, "DRAW")) {
    const a5Class =
      variantId === "D02" || variantId === "S02"
        ? classifyA5Hand({ cleanLow, highestRank, pairedHand, lowTexture })
        : null;
    const s02SingleDrawClass =
      variantId === "S02"
        ? classifyA5SingleDrawHand({ cleanLow, pairedHand, highestRank })
        : "";
    const discardIndexes =
      variantId === "D02" || variantId === "S02"
        ? chooseA5DrawDiscardIndexes({
            hand,
            evaluation,
            highestRank,
            maxDiscardCount,
            maxDrawRounds,
            drawRound,
            pairedHand,
            a5Class:
              variantId === "S02" && ["premiumSDA5", "strongSDA5"].includes(s02SingleDrawClass)
                ? "strongA5"
                : a5Class,
          })
        : chooseSingleDrawIndexes(
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
    const a5SingleDrawDetail =
      variantId === "S02"
        ? classifyA5SingleDrawDetail({ cleanLow, pairedHand, highestRank, lowTexture })
        : {};
    const a5SingleDrawClass = a5SingleDrawDetail.a5SingleDrawClass ?? "";
    const sd27Detail =
      variantId === "S01"
        ? classify27SingleDrawDetail({ cleanLow, pairedHand, penaltyHand, highestRank, lowTexture })
        : {};
    const sd27Class = sd27Detail.sd27Class ?? "";
    const singleDrawClass = classifySingleDrawFinalHand({
      lowType,
      cleanLow,
      pairedHand,
      highestRank,
      smoothMadeLow,
      premiumPat,
      strongPat,
    });
  return chooseSingleDrawFinalBettingAction({
    variantId,
    snapshot,
    lowType,
    singleDrawClass,
      a5SingleDrawClass,
      a5SingleDrawDetail,
      sd27Class,
      legalActions,
      facingBet,
      facingRaise,
      expensiveCall,
      premiumPat,
      smoothMadeLow,
    betSizeBucket,
    toCall,
    drawRound,
    highestRank,
    lowTexture,
    penaltyHand,
    sd27Detail,
  });
}

  if (variantId === "S01" && singleDraw && !finalBettingRound && facingBet) {
    const sd27Detail = classify27SingleDrawDetail({ cleanLow, pairedHand, penaltyHand, highestRank, lowTexture });
    const sd27Class = sd27Detail.sd27Class ?? "";
    const opponentCount = getActiveOpponentCount(snapshot, actor);
    const multiwayPot = isMultiwayPot(snapshot, actor);
    const fourWayOrMore = opponentCount >= 3;
    const tinyCall = betSizeBucket === "small" && toCall <= 10;
    const smallCall = betSizeBucket === "small" && toCall <= 20;
    const selectedMediumCall = betSizeBucket === "medium" && toCall <= 15 && !fourWayOrMore;
    const topEndSafeMediumCall =
      betSizeBucket === "medium" &&
      toCall <= 20 &&
      !fourWayOrMore &&
      !facingRaise &&
      sd27Detail.upperStrongSD27;

    if (sd27Class === "strongSD27") {
      if (sd27Detail.roughEightUpper && hasLegalAction(legalActions, "CALL") && smallCall && !fourWayOrMore) {
        return {
          type: "CALL",
          confidence: 0.62,
          reason: multiwayPot ? "s01-strong-early-multiway-small-call" : "s01-strong-early-small-call",
        };
      }
      if (sd27Detail.upperStrongSD27 && hasLegalAction(legalActions, "CALL") && selectedMediumCall && !fourWayOrMore) {
        return {
          type: "CALL",
          confidence: 0.57,
          reason: multiwayPot ? "s01-strong-top-end-early-medium-call" : "s01-strong-top-end-early-hu-medium-call",
        };
      }
      if (topEndSafeMediumCall && hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.59,
          reason: multiwayPot ? "s01-strong-top-end-early-safe-medium-call" : "s01-strong-top-end-early-safe-hu-medium-call",
        };
      }
      if (sd27Detail.smoothNine && hasLegalAction(legalActions, "CALL") && tinyCall && !fourWayOrMore) {
        return {
          type: "CALL",
          confidence: 0.58,
          reason: multiwayPot ? "s01-strong-early-smooth-nine-multiway-call" : "s01-strong-early-smooth-nine-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD") && (betSizeBucket !== "small" || fourWayOrMore)) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: fourWayOrMore ? "s01-strong-early-4way-pressure-fold" : "s01-strong-early-pressure-fold",
        };
      }
    }

    if (["trashSD27", "weakSD27"].includes(sd27Class)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.88,
          reason:
            sd27Class === "trashSD27"
              ? multiwayPot
                ? "s01-trash-early-multiway-call-guard-fold"
                : "s01-trash-early-call-guard-fold"
              : multiwayPot
                ? "s01-weak-early-multiway-call-guard-fold"
                : "s01-weak-early-call-guard-fold",
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: 0.7,
          reason:
            sd27Class === "trashSD27"
              ? "s01-trash-early-call-guard-check"
              : "s01-weak-early-call-guard-check",
        };
      }
    }

    if (sd27Class === "mediumSD27") {
      if (sd27Detail.upperMediumSD27) {
        if (hasLegalAction(legalActions, "CALL") && smallCall && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.58,
            reason: multiwayPot ? "s01-upper-medium-small-call" : "s01-upper-medium-hu-small-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.84,
            reason: fourWayOrMore ? "s01-upper-medium-4way-pressure-fold" : "s01-upper-medium-pressure-fold",
          };
        }
      }

      if (sd27Detail.lowerMediumSD27 || sd27Detail.tlowSD27) {
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: fourWayOrMore ? 0.88 : 0.84,
            reason:
              sd27Detail.tlowSD27
                ? multiwayPot
                  ? "s01-tlow-multiway-call-guard-fold"
                  : "s01-tlow-call-guard-fold"
                : fourWayOrMore
                  ? "s01-lower-medium-4way-call-guard-fold"
                  : multiwayPot
                    ? "s01-lower-medium-multiway-call-guard-fold"
                    : "s01-lower-medium-call-guard-fold",
          };
        }
      }
    }
  }

  if (variantId === "S02" && singleDraw && !finalBettingRound && !facingBet) {
    const a5SingleDrawDetail = classifyA5SingleDrawDetail({ cleanLow, pairedHand, highestRank, lowTexture });
    const a5SingleDrawClass = a5SingleDrawDetail.a5SingleDrawClass ?? "";
    const multiwayPot = isMultiwayPot(snapshot, actor);
    const opponentCount = getActiveOpponentCount(snapshot, actor);
    const fourWayOrMore = opponentCount >= 3;
    const threeWay = opponentCount === 2;

    if (a5SingleDrawClass === "premiumSDA5" && canOpenBet(legalActions)) {
      return {
        type: "BET",
        confidence: 0.74,
        reason: multiwayPot ? "s02-premium-early-open-value-bet" : "s02-premium-early-heads-up-open-value-bet",
      };
    }

    if (a5SingleDrawClass === "strongSDA5" && canOpenBet(legalActions)) {
      return {
        type: "BET",
        confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.7 : multiwayPot ? 0.64 : 0.66,
        reason: a5SingleDrawDetail.upperStrongSDA5
          ? "s02-strong-early-upper-open-value-bet"
          : multiwayPot
            ? "s02-strong-early-multiway-open-value-bet"
            : "s02-strong-early-open-value-bet",
      };
    }

    if (a5SingleDrawClass === "mediumSDA5") {
      if (a5SingleDrawDetail.upperMediumSDA5 && canOpenBet(legalActions)) {
        if (!multiwayPot) {
          return {
            type: "BET",
            confidence: 0.62,
            reason: "s02-upper-medium-early-heads-up-thin-value-bet",
          };
        }
        if (threeWay) {
          return {
            type: "BET",
            confidence: 0.57,
            reason: "s02-upper-medium-early-3way-thin-value-bet",
          };
        }
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: a5SingleDrawDetail.upperMediumSDA5 ? (fourWayOrMore ? 0.76 : 0.72) : 0.8,
          reason: a5SingleDrawDetail.upperMediumSDA5
            ? "s02-upper-medium-early-check"
            : "s02-lower-medium-early-check",
        };
      }
    }
  }

  if (variantId === "S02" && singleDraw && !finalBettingRound && facingBet) {
    const a5SingleDrawDetail = classifyA5SingleDrawDetail({ cleanLow, pairedHand, highestRank, lowTexture });
    const a5SingleDrawClass = a5SingleDrawDetail.a5SingleDrawClass ?? "";
    const opponentCount = getActiveOpponentCount(snapshot, actor);
    const multiwayPot = isMultiwayPot(snapshot, actor);
    const fourWayOrMore = opponentCount >= 3;
    const headsUp = opponentCount <= 1;

    if (a5SingleDrawClass === "premiumSDA5") {
      if (
        hasLegalAction(legalActions, "RAISE") &&
        !facingRaise &&
        (betSizeBucket === "small" || betSizeBucket === "medium")
      ) {
        return {
          type: "RAISE",
          confidence: betSizeBucket === "small" ? 0.78 : multiwayPot ? 0.7 : 0.72,
          reason:
            betSizeBucket === "small"
              ? multiwayPot
                ? "s02-premium-early-multiway-small-value-raise"
                : "s02-premium-early-small-value-raise"
              : multiwayPot
                ? "s02-premium-early-multiway-medium-value-raise"
                : "s02-premium-early-medium-value-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && (!fourWayOrMore || betSizeBucket === "small")) {
        return {
          type: "CALL",
          confidence: 0.7,
          reason: multiwayPot ? "s02-premium-early-multiway-defend-call" : "s02-premium-early-defend-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.72,
          reason: "s02-premium-early-large-pressure-fold",
        };
      }
    }

    if (a5SingleDrawClass === "strongSDA5") {
      if (
        a5SingleDrawDetail.upperStrongSDA5 &&
        hasLegalAction(legalActions, "RAISE") &&
        !fourWayOrMore &&
        !facingRaise &&
        (betSizeBucket === "small" || (!multiwayPot && betSizeBucket === "medium"))
      ) {
        return {
          type: "RAISE",
          confidence: betSizeBucket === "small" ? 0.7 : 0.66,
          reason:
            betSizeBucket === "small"
              ? "s02-strong-early-upper-small-value-raise"
              : "s02-strong-early-upper-medium-thin-value-raise",
        };
      }
      if (
        hasLegalAction(legalActions, "RAISE") &&
        !facingRaise &&
        betSizeBucket === "small" &&
        (headsUp || opponentCount === 2)
      ) {
        return {
          type: "RAISE",
          confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.68 : 0.64,
          reason: headsUp ? "s02-strong-early-safe-pressure-thin-raise" : "s02-strong-early-3way-safe-pressure-thin-raise",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && betSizeBucket === "small") {
        return {
          type: "CALL",
          confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.68 : 0.64,
          reason: multiwayPot ? "s02-strong-early-multiway-small-call" : "s02-strong-early-small-call",
        };
      }
      if (hasLegalAction(legalActions, "CALL") && betSizeBucket === "medium" && !fourWayOrMore) {
        return {
          type: "CALL",
          confidence: a5SingleDrawDetail.upperStrongSDA5 ? 0.63 : 0.6,
          reason: multiwayPot ? "s02-strong-early-3way-medium-call" : "s02-strong-early-medium-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: fourWayOrMore ? 0.8 : 0.76,
          reason: fourWayOrMore ? "s02-strong-early-4way-pressure-fold" : "s02-strong-early-pressure-fold",
        };
      }
    }

    if (["trashSDA5", "weakSDA5"].includes(a5SingleDrawClass)) {
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.88,
          reason:
            a5SingleDrawClass === "trashSDA5"
              ? multiwayPot
                ? "s02-trash-early-multiway-call-guard-fold"
                : "s02-trash-early-call-guard-fold"
              : multiwayPot
                ? "s02-weak-early-multiway-call-guard-fold"
                : "s02-weak-early-call-guard-fold",
        };
      }
      if (hasLegalAction(legalActions, "CHECK")) {
        return {
          type: "CHECK",
          confidence: 0.7,
          reason:
            a5SingleDrawClass === "trashSDA5"
              ? "s02-trash-early-call-guard-check"
              : "s02-weak-early-call-guard-check",
        };
      }
    }

    if (a5SingleDrawClass === "mediumSDA5") {
      if (a5SingleDrawDetail.lowerMediumSDA5) {
        if (!multiwayPot && hasLegalAction(legalActions, "CALL") && betSizeBucket === "small" && toCall <= 5) {
          return {
            type: "CALL",
            confidence: 0.54,
            reason: "s02-lower-medium-hu-min-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: fourWayOrMore ? 0.86 : 0.82,
            reason: fourWayOrMore
              ? "s02-lower-medium-4way-call-guard-fold"
              : multiwayPot
                ? "s02-lower-medium-multiway-call-guard-fold"
                : "s02-lower-medium-pressure-fold",
          };
        }
      }

      if (a5SingleDrawDetail.upperMediumSDA5) {
        if (hasLegalAction(legalActions, "CALL") && betSizeBucket === "small" && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.58,
            reason: multiwayPot ? "s02-upper-medium-small-call" : "s02-upper-medium-hu-small-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.82,
            reason: fourWayOrMore ? "s02-upper-medium-4way-pressure-fold" : "s02-upper-medium-pressure-fold",
          };
        }
      }
    }
  }

  if (variantId === "D02") {
    const d02Class = classifyA5Hand({ cleanLow, highestRank, pairedHand, lowTexture });
    const d02OpponentCount = getActiveOpponentCount(snapshot, actor);
    const d02MultiwayPot = d02OpponentCount >= 2;
    const d02FourWayOrMore = d02OpponentCount >= 3;
    const d02UpperMedium =
      d02Class === "mediumA5" &&
      (lowTexture.secondHighest ?? 99) <= 4 &&
      (lowTexture.largestGap ?? 99) <= 3;
    const d02LowerMedium = d02Class === "mediumA5" && !d02UpperMedium;
    const repeatedFacingPressure = facingBet && drawRound > 0 && betSizeBucket !== "small";
    const d02DangerousMultiwayPressure =
      d02OpponentCount >= 4 ||
      (d02OpponentCount >= 3 && (betSizeBucket !== "small" || toCall > 15));
    const safeSecondPressureWindow =
      drawRound > 0 &&
      drawRound <= 2 &&
      (betSizeBucket === "small" || betSizeBucket === "medium") &&
      toCall <= 20 &&
      !d02DangerousMultiwayPressure &&
      !expensiveCall;
    if (finalBettingRound) {
      if (d02Class === "premiumA5") {
        if (facingBet && canSafelyValueRaise(snapshot, legalActions)) {
          return {
            type: "RAISE",
            confidence: 0.8,
            reason: "d02-premium-final-value-raise",
          };
        }
        if (!facingBet && openBetLegal) {
          return {
            type: "BET",
            confidence: 0.78,
            reason: "d02-premium-final-value-bet",
          };
        }
        if (facingBet && hasLegalAction(legalActions, "CALL") && !expensiveCall) {
          return {
            type: "CALL",
            confidence: 0.72,
            reason: "d02-premium-final-defend-call",
          };
        }
      }

      if (d02Class === "strongA5") {
        if (!facingBet && openBetLegal) {
          return {
            type: "BET",
            confidence: 0.74,
            reason: "d02-strong-final-value-bet",
          };
        }
        if (
          facingBet &&
          hasLegalAction(legalActions, "CALL") &&
          !expensiveCall &&
          betSizeBucket === "small" &&
          toCall <= 15 &&
          !d02FourWayOrMore
        ) {
          return {
            type: "CALL",
            confidence: 0.66,
            reason: "d02-strong-final-small-defend-call",
          };
        }
        if (facingBet && hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.82,
            reason: repeatedFacingPressure ? "d02-strong-final-repeat-pressure-fold" : "d02-strong-final-fold",
          };
        }
      }

      if (d02Class === "mediumA5") {
        if (!facingBet && hasLegalAction(legalActions, "CHECK")) {
          return {
            type: "CHECK",
            confidence: d02UpperMedium ? 0.74 : 0.8,
            reason: d02UpperMedium ? "d02-upper-medium-final-check" : "d02-lower-medium-final-check",
          };
        }
        if (
          d02UpperMedium &&
          facingBet &&
          hasLegalAction(legalActions, "CALL") &&
          !expensiveCall &&
          betSizeBucket === "small" &&
          toCall <= 10 &&
          !d02MultiwayPot
        ) {
          return {
            type: "CALL",
            confidence: 0.6,
            reason: "d02-upper-medium-final-small-call",
          };
        }
        if (facingBet && hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.82,
            reason: d02LowerMedium ? "d02-lower-medium-final-fold" : "d02-upper-medium-final-fold",
          };
        }
      }

      if (["weakA5", "trashA5"].includes(d02Class)) {
        if (facingBet && hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.86,
            reason: d02Class === "trashA5" ? "d02-trash-final-fold" : "d02-weak-final-fold",
          };
        }
        if (!facingBet && hasLegalAction(legalActions, "CHECK")) {
          return {
            type: "CHECK",
            confidence: 0.82,
            reason: d02Class === "trashA5" ? "d02-trash-final-check" : "d02-weak-final-check",
          };
        }
      }
    }

    if (!finalBettingRound && facingBet) {
      if (d02Class === "trashA5" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.84,
          reason: "d02-trash-early-fold",
        };
      }
      if (d02Class === "weakA5" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: "d02-early-weak-fold",
        };
      }
      if (d02Class === "mediumA5" && betSizeBucket === "large" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.8,
          reason: "d02-early-medium-large-fold",
        };
      }
      if (
        d02UpperMedium &&
        hasLegalAction(legalActions, "CALL") &&
        betSizeBucket === "small" &&
        toCall <= 10 &&
        !d02MultiwayPot &&
        !facingRaise
      ) {
        return {
          type: "CALL",
          confidence: 0.58,
          reason: "d02-early-upper-medium-small-call",
        };
      }
      if (d02Class === "premiumA5" && hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.64,
          reason: "d02-early-premium-continue",
        };
      }
      if (d02Class === "strongA5") {
        if (
          safeSecondPressureWindow &&
          hasLegalAction(legalActions, "RAISE")
        ) {
          return {
            type: "RAISE",
            confidence: betSizeBucket === "small" ? 0.65 : 0.62,
            reason:
              betSizeBucket === "small"
                ? "d02-early-strong-stable-second-pressure-small-raise"
                : "d02-early-strong-stable-second-pressure-raise",
          };
        }
        if (
          safeSecondPressureWindow &&
          hasLegalAction(legalActions, "CALL")
        ) {
          return {
            type: "CALL",
            confidence: betSizeBucket === "small" ? 0.62 : 0.59,
            reason:
              betSizeBucket === "small"
                ? "d02-early-strong-stable-second-pressure-small-call"
                : "d02-early-strong-stable-second-pressure-call",
          };
        }
        if (
          hasLegalAction(legalActions, "RAISE") &&
          drawRound > 0 &&
          drawRound <= 2 &&
          (betSizeBucket === "small" || betSizeBucket === "medium") &&
          toCall <= 15 &&
          !d02MultiwayPot &&
          !facingRaise &&
          !repeatedFacingPressure
        ) {
          return {
            type: "RAISE",
            confidence: betSizeBucket === "small" ? 0.64 : 0.61,
            reason:
              betSizeBucket === "small"
                ? "d02-early-strong-safe-second-pressure-small-raise"
                : "d02-early-strong-safe-second-pressure-raise",
          };
        }
        if (
          hasLegalAction(legalActions, "CALL") &&
          betSizeBucket === "small" &&
          toCall <= 15 &&
          (drawRound === 0 || !d02MultiwayPot)
        ) {
          return {
            type: "CALL",
            confidence: 0.62,
            reason: "d02-early-strong-small-call",
          };
        }
        if (
          hasLegalAction(legalActions, "CALL") &&
          betSizeBucket === "medium" &&
          drawRound <= 2 &&
          toCall <= 15 &&
          !d02MultiwayPot &&
          !facingRaise &&
          !repeatedFacingPressure
        ) {
          return {
            type: "CALL",
            confidence: 0.58,
            reason: drawRound === 0 ? "d02-early-strong-first-medium-call" : "d02-early-strong-safe-second-pressure-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.8,
            reason: repeatedFacingPressure ? "d02-early-strong-repeat-pressure-fold" : "d02-early-strong-fold",
          };
        };
      }
    }
  }

  if (variantId === "D01") {
    const d01Detail = classify27TripleDrawDetail({
      cleanLow,
      pairedHand,
      penaltyHand,
      highestRank,
      lowTexture,
    });
    const d01Class = d01Detail.td27Class ?? "weak27TD";
    const opponentCount = getActiveOpponentCount(snapshot, actor);
    const fourWayOrMore = opponentCount >= 3;
    const largePressure = expensiveCall || betSizeBucket === "large";
    const tinyCall = betSizeBucket === "small" && toCall <= 10;
    const smallCall = betSizeBucket === "small" && toCall <= 20;
    const selectedMediumCall = betSizeBucket === "medium" && toCall <= 15 && !fourWayOrMore;

    if (facingBet && !finalBettingRound) {
      if (d01Class === "trash27TD" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.86,
          reason: penaltyHand ? "d01-early-penalty-fold" : "d01-early-trash-fold",
        };
      }
      if (d01Class === "weak27TD" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.82,
          reason: "d01-early-weak-fold",
        };
      }
      if (d01Class === "medium27TD") {
        if (d01Detail.upperRough9TD && hasLegalAction(legalActions, "CALL") && tinyCall && drawRound <= 1 && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.56,
            reason: "d01-early-upper-rough9-small-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.82,
            reason: d01Detail.tlowTD ? "d01-early-tlow-fold" : "d01-early-medium-fold",
          };
        }
      }
      if (d01Class === "strong27TD") {
        if (d01Detail.roughEightTD && hasLegalAction(legalActions, "CALL") && smallCall && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.6,
            reason: "d01-early-rough-eight-small-call",
          };
        }
        if (d01Detail.smoothNineUpper && hasLegalAction(legalActions, "CALL") && tinyCall && drawRound === 0 && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.58,
            reason: "d01-early-smooth-nine-tiny-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD") && (betSizeBucket !== "small" || fourWayOrMore)) {
          return {
            type: "FOLD",
            confidence: 0.8,
            reason: "d01-early-strong-pressure-fold",
          };
        }
      }
    }

    if (facingBet && finalBettingRound) {
      if (d01Class === "trash27TD" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.88,
          reason: penaltyHand ? "d01-final-penalty-fold" : "d01-final-trash-fold",
        };
      }
      if (d01Class === "weak27TD" && hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.86,
          reason: "d01-final-weak-fold",
        };
      }
      if (d01Class === "premium27TD") {
        if (premiumPat && canSafelyValueRaise(snapshot, legalActions) && !largePressure) {
          return {
            type: "RAISE",
            confidence: 0.77,
            reason: "d01-premium-final-value-raise",
          };
        }
        if (hasLegalAction(legalActions, "CALL") && !expensiveCall) {
          return {
            type: "CALL",
            confidence: 0.72,
            reason: "d01-premium-final-defend-call",
          };
        }
      }
      if (d01Class === "strong27TD") {
        if (d01Detail.roughEightTD && hasLegalAction(legalActions, "CALL") && smallCall && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.62,
            reason: "d01-final-rough-eight-small-call",
          };
        }
        if (d01Detail.roughEightTD && hasLegalAction(legalActions, "CALL") && selectedMediumCall && lowTexture.secondHighest <= 6) {
          return {
            type: "CALL",
            confidence: 0.58,
            reason: "d01-final-rough-eight-medium-call",
          };
        }
        if (d01Detail.smoothNineUpper && hasLegalAction(legalActions, "CALL") && tinyCall && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.56,
            reason: "d01-final-smooth-nine-tiny-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.84,
            reason: largePressure ? "d01-final-strong-large-fold" : "d01-final-strong-pressure-fold",
          };
        }
      }
      if (d01Class === "medium27TD") {
        if (d01Detail.upperRough9TD && hasLegalAction(legalActions, "CALL") && tinyCall && !fourWayOrMore) {
          return {
            type: "CALL",
            confidence: 0.54,
            reason: "d01-final-upper-rough9-tiny-call",
          };
        }
        if (hasLegalAction(legalActions, "FOLD")) {
          return {
            type: "FOLD",
            confidence: 0.86,
            reason: d01Detail.lowerRough9TD
              ? "d01-final-lower-rough9-fold"
              : d01Detail.tlowTD
                ? "d01-final-tlow-fold"
                : "d01-final-medium-pressure-fold",
          };
        }
      }
    }
  }

  if (variantId === "D01" && facingBet) {
    if (penaltyHand && hasLegalAction(legalActions, "FOLD") && (finalBettingRound || betSizeBucket !== "small")) {
      return {
        type: "FOLD",
        confidence: 0.82,
        reason: "d01-penalty-pressure-fold",
      };
    }
    if (cleanLow && highestRank >= 9 && hasLegalAction(legalActions, "FOLD")) {
      return {
        type: "FOLD",
        confidence: 0.82,
        reason: finalBettingRound ? "d01-nine-low-final-fold" : "d01-nine-low-pressure-fold",
      };
    }
    if (cleanLow && highestRank === 8 && roughMadeLow) {
      if (betSizeBucket === "small" && toCall <= 20 && !expensiveCall && hasLegalAction(legalActions, "CALL")) {
        return {
          type: "CALL",
          confidence: 0.58,
          reason: "d01-rough-eight-small-call",
        };
      }
      if (hasLegalAction(legalActions, "FOLD")) {
        return {
          type: "FOLD",
          confidence: 0.8,
          reason: "d01-rough-eight-pressure-fold",
        };
      }
    }
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
