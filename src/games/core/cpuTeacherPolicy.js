const TIER_PRESETS = {
  beginner: {
    openThreshold: 0.48,
    callThreshold: 0.34,
    raiseThreshold: 0.82,
    bluffCredit: 0.02,
  },
  standard: {
    openThreshold: 0.55,
    callThreshold: 0.42,
    raiseThreshold: 0.78,
    bluffCredit: 0.04,
  },
  strong: {
    openThreshold: 0.58,
    callThreshold: 0.45,
    raiseThreshold: 0.74,
    bluffCredit: 0.05,
  },
  pro: {
    openThreshold: 0.6,
    callThreshold: 0.48,
    raiseThreshold: 0.72,
    bluffCredit: 0.06,
  },
  iron: {
    openThreshold: 0.62,
    callThreshold: 0.5,
    raiseThreshold: 0.7,
    bluffCredit: 0.07,
  },
  worldmaster: {
    openThreshold: 0.64,
    callThreshold: 0.52,
    raiseThreshold: 0.68,
    bluffCredit: 0.08,
  },
};

const RANK_VALUE = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
};

const POSITION_ORDER = ["UTG", "MP", "CO", "BTN", "SB", "BB"];

const BOARD_OPEN_FLOORS = {
  nlh: { UTG: 0.74, MP: 0.68, CO: 0.6, BTN: 0.5, SB: 0.56, BB: 0.3 },
  flh: { UTG: 0.68, MP: 0.62, CO: 0.55, BTN: 0.48, SB: 0.52, BB: 0.28 },
  plo: { UTG: 0.8, MP: 0.73, CO: 0.66, BTN: 0.58, SB: 0.64, BB: 0.36 },
  plo8: { UTG: 0.78, MP: 0.7, CO: 0.62, BTN: 0.54, SB: 0.6, BB: 0.34 },
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function tierPolicy(tierConfig = {}) {
  const id = tierConfig?.id ?? "standard";
  const preset = TIER_PRESETS[id] ?? TIER_PRESETS.standard;
  return {
    ...preset,
    openThreshold: clamp(tierConfig.openThreshold ?? preset.openThreshold, 0.1, 0.95),
    callThreshold: clamp(tierConfig.callThreshold ?? preset.callThreshold, 0.1, 0.95),
    raiseThreshold: clamp(tierConfig.raiseThreshold ?? preset.raiseThreshold, 0.1, 0.98),
    bluffCredit: clamp(tierConfig.bluffWeight ?? tierConfig.bluffFrequency ?? preset.bluffCredit, 0, 0.2),
  };
}

function parseRank(card) {
  const match = String(card ?? "").trim().toUpperCase().match(/^(10|[2-9TJQKA])/);
  if (!match) return 0;
  const label = match[1] === "10" ? "T" : match[1];
  const numericRank = Number(label);
  return RANK_VALUE[label] ?? (Number.isFinite(numericRank) ? numericRank : 0);
}

function parseSuit(card) {
  return String(card ?? "").trim().slice(-1).toUpperCase();
}

function normalizeBoardFamily(variantId = "B01") {
  const normalized = String(variantId ?? "").toLowerCase();
  if (normalized.includes("plo8") || normalized.includes("flo8") || normalized === "b06" || normalized === "b09") return "plo8";
  if (
    normalized.includes("plo") ||
    normalized.includes("omaha") ||
    ["b05", "b07", "b08"].includes(normalized)
  ) {
    return "plo";
  }
  if (normalized.includes("flh") || normalized.includes("fixed") || normalized === "b02") return "flh";
  return "nlh";
}

function normalizePosition(position = null) {
  const label = String(position ?? "").trim().toUpperCase();
  return POSITION_ORDER.includes(label) ? label : "MP";
}

function suitedness(cards = []) {
  const suits = cards.map(parseSuit).filter(Boolean);
  if (!suits.length) return 0;
  const counts = new Map();
  suits.forEach((suit) => counts.set(suit, (counts.get(suit) ?? 0) + 1));
  return Math.max(...counts.values()) / suits.length;
}

function rankCounts(cards = []) {
  const counts = new Map();
  cards.forEach((card) => {
    const rank = parseRank(card);
    if (rank > 0) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  });
  return counts;
}

function highestPairScore(cards = []) {
  const counts = rankCounts(cards);
  let bestPair = 0;
  counts.forEach((count, rank) => {
    if (count >= 2) bestPair = Math.max(bestPair, rank);
  });
  return bestPair > 0 ? bestPair / 14 : 0;
}

function pairRank(cards = []) {
  const counts = rankCounts(cards);
  let bestPair = 0;
  counts.forEach((count, rank) => {
    if (count >= 2) bestPair = Math.max(bestPair, rank);
  });
  return bestPair;
}

function countBroadways(ranks = []) {
  return ranks.filter((rank) => rank >= 10 || rank === 14).length;
}

function countLowWheel(ranks = []) {
  return new Set(ranks.map((rank) => (rank === 14 ? 1 : rank)).filter((rank) => rank >= 1 && rank <= 5)).size;
}

function doubleSuitedCredit(cards = []) {
  const counts = new Map();
  cards.map(parseSuit).filter(Boolean).forEach((suit) => counts.set(suit, (counts.get(suit) ?? 0) + 1));
  const pairedSuits = [...counts.values()].filter((count) => count >= 2).length;
  if (pairedSuits >= 2) return 0.16;
  if (pairedSuits === 1) return 0.08;
  return 0;
}

export function estimateNlhPreflopRangeScore({ holeCards = [], position = "MP" } = {}) {
  const ranks = holeCards.map(parseRank).filter(Boolean).sort((a, b) => b - a);
  if (ranks.length < 2) return 0.05;
  const [hi, lo] = ranks;
  const pair = hi === lo;
  const suited = suitedness(holeCards) >= 1;
  const gap = Math.abs(hi - lo);
  const broadways = countBroadways(ranks);
  const ace = hi === 14;
  let score = pair
    ? 0.36 + (hi / 14) * 0.58
    : (hi + lo) / 30 + (ace ? 0.08 : 0) + broadways * 0.035;
  if (suited) score += 0.08;
  if (!pair && gap <= 1) score += 0.07;
  else if (!pair && gap === 2) score += 0.04;
  if (!pair && hi <= 9 && gap >= 4) score -= 0.12;
  if (!suited && hi <= 11 && lo <= 8) score -= 0.08;
  const positionCredit = { UTG: -0.03, MP: -0.01, CO: 0.02, BTN: 0.06, SB: -0.01, BB: 0.03 }[normalizePosition(position)] ?? 0;
  return clamp(score + positionCredit, 0.05, 0.98);
}

export function estimateOmahaPreflopRangeScore({ holeCards = [], variantId = "B05", position = "MP" } = {}) {
  const ranks = holeCards.map(parseRank).filter(Boolean).sort((a, b) => b - a);
  if (ranks.length < 4) return 0.05;
  const family = normalizeBoardFamily(variantId);
  const uniqueRanks = new Set(ranks).size;
  const highDensity = countBroadways(ranks) / ranks.length;
  const span = Math.max(...ranks) - Math.min(...ranks);
  const connectedCredit = clamp((9 - Math.min(9, span)) * 0.035, 0, 0.22);
  const pair = pairRank(holeCards);
  const premiumPairCredit = pair >= 13 ? 0.18 : pair >= 10 ? 0.1 : pair >= 2 ? 0.03 : 0;
  const suitCredit = doubleSuitedCredit(holeCards);
  const danglerPenalty = uniqueRanks >= 3 && ranks.filter((rank) => rank <= 7).length >= 1 && span >= 9 ? 0.08 : 0;
  let score = 0.24 + highDensity * 0.24 + connectedCredit + premiumPairCredit + suitCredit - danglerPenalty;
  if (family === "plo8") {
    const wheelCount = countLowWheel(ranks);
    const hasAce = ranks.includes(14);
    const hasTwo = ranks.includes(2);
    const hasThree = ranks.includes(3);
    const lowNutCredit = hasAce && hasTwo ? 0.2 : hasAce && (hasThree || wheelCount >= 3) ? 0.12 : 0;
    const scoopCredit = lowNutCredit > 0 && (pair >= 13 || highDensity >= 0.5 || suitCredit >= 0.08) ? 0.1 : 0;
    score += lowNutCredit + scoopCredit - (wheelCount === 0 && highDensity < 0.5 ? 0.08 : 0);
  }
  const positionCredit = { UTG: -0.04, MP: -0.015, CO: 0.025, BTN: 0.07, SB: -0.015, BB: 0.035 }[normalizePosition(position)] ?? 0;
  return clamp(score + positionCredit, 0.05, 0.98);
}

export function estimateBoardHandStrength({
  holeCards = [],
  boardCards = [],
  evaluation = null,
  variantId = "B01",
  position = "MP",
} = {}) {
  const categoryRank = Number(evaluation?.categoryRank);
  if (Number.isFinite(categoryRank)) {
    return clamp((categoryRank + 1) / 9);
  }
  if (!boardCards.length) {
    const family = normalizeBoardFamily(variantId);
    if (family === "plo" || family === "plo8") {
      return estimateOmahaPreflopRangeScore({ holeCards, variantId, position });
    }
    return estimateNlhPreflopRangeScore({ holeCards, position });
  }
  const ranks = holeCards.map(parseRank).filter((rank) => rank > 0).sort((a, b) => b - a);
  const highCard = ranks[0] ?? 2;
  const secondCard = ranks[1] ?? 2;
  const pairScore = highestPairScore(holeCards);
  const suitedCredit = suitedness(holeCards) >= 0.5 ? 0.08 : 0;
  const connectedCredit = ranks.length >= 2 && Math.abs(ranks[0] - ranks[1]) <= 2 ? 0.06 : 0;
  const family = normalizeBoardFamily(variantId);
  const omahaWrapCredit = family === "plo" || family === "plo8"
    ? clamp((ranks.filter((rank) => rank >= 9).length - 1) * 0.06, 0, 0.18)
    : 0;
  const boardPairPressure = boardCards.length >= 3 ? highestPairScore(boardCards) * 0.08 : 0;
  return clamp(
    Math.max(pairScore, (highCard + secondCard) / 30) +
      suitedCredit +
      connectedCredit +
      omahaWrapCredit -
      boardPairPressure,
    0.05,
    0.98,
  );
}

export function estimateStudHandStrength({
  holeCards = [],
  upCards = [],
  evaluation = null,
  variant = "stud",
} = {}) {
  if (Number.isFinite(evaluation?.rankPrimary)) {
    const isLow = ["razz", "razz27", "razzdugi", "razzducey"].includes(variant);
    const score = Number(evaluation.rankPrimary);
    return isLow ? clamp(1 - score / 1_000_000, 0.05, 0.98) : clamp(1 - score / 9_000_000, 0.05, 0.98);
  }
  const cards = [...holeCards, ...upCards];
  const ranks = cards.map(parseRank).filter(Boolean);
  const pairScore = highestPairScore(cards);
  const lowRanks = ranks.filter((rank) => rank <= 8 || rank === 14).length;
  const exposedLowCredit = lowRanks / Math.max(3, ranks.length);
  const highCard = Math.max(0, ...ranks) / 14;
  if (["razz", "razz27", "razzdugi", "razzducey"].includes(variant)) {
    return clamp(exposedLowCredit - pairScore * 0.25 + suitedness(upCards) * 0.03, 0.05, 0.96);
  }
  return clamp(Math.max(pairScore, highCard * 0.62) + suitedness(upCards) * 0.05, 0.05, 0.96);
}

export function chooseTeacherBetAction({
  strength = 0,
  toCall = 0,
  canRaise = true,
  tierConfig = {},
  betAmount = 0,
  currentBet = 0,
  playerBet = 0,
  street = "",
  variantId = "B01",
  position = "MP",
  activeOpponents = 1,
} = {}) {
  const policy = tierPolicy(tierConfig);
  const normalizedStrength = clamp(Number(strength) || 0);
  const normalizedStreet = String(street).toUpperCase();
  const family = normalizeBoardFamily(variantId);
  const positionLabel = normalizePosition(position);
  const lateStreet = ["TURN", "RIVER", "FIFTH", "SIXTH", "SEVENTH"].includes(normalizedStreet);
  const preflop = normalizedStreet === "PREFLOP";
  const openFloor = BOARD_OPEN_FLOORS[family]?.[positionLabel] ?? policy.openThreshold;
  const multiwayPenalty = Math.max(0, Number(activeOpponents) - 1) * (family === "plo" || family === "plo8" ? 0.035 : 0.02);
  const callThreshold = clamp(policy.callThreshold + (lateStreet ? 0.04 : 0), 0.05, 0.95);
  const openThreshold = preflop
    ? clamp(openFloor + (tierConfig?.id === "beginner" ? 0.04 : 0) + multiwayPenalty, 0.05, 0.95)
    : clamp(policy.openThreshold + (lateStreet ? 0.02 : 0), 0.05, 0.95);
  const continueThreshold = preflop
    ? clamp(openThreshold - (positionLabel === "BB" ? 0.18 : 0.08), 0.12, 0.9)
    : callThreshold;
  const raiseThreshold = clamp(policy.raiseThreshold - policy.bluffCredit * 0.25, 0.1, 0.98);
  const amount = Math.max(0, Number(betAmount) || 0);

  if (toCall > 0) {
    if (normalizedStrength < continueThreshold) {
      return { type: "FOLD", metadata: { strategy: "teacher-supervised", reason: "below-call-threshold" } };
    }
    if (canRaise && normalizedStrength >= raiseThreshold) {
      return { type: "RAISE", amount, metadata: { strategy: "teacher-supervised", reason: "value-raise" } };
    }
    return { type: "CALL", amount: toCall, metadata: { strategy: "teacher-supervised", reason: "continue" } };
  }

  if (canRaise && normalizedStrength >= openThreshold) {
    const actionType = currentBet > playerBet ? "RAISE" : "BET";
    return { type: actionType, amount, metadata: { strategy: "teacher-supervised", reason: "first-in-value" } };
  }
  return { type: "CHECK", metadata: { strategy: "teacher-supervised", reason: "pot-control" } };
}
