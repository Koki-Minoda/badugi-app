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

function suitedness(cards = []) {
  const suits = cards.map((card) => String(card ?? "").trim().slice(-1).toUpperCase()).filter(Boolean);
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

export function estimateBoardHandStrength({
  holeCards = [],
  boardCards = [],
  evaluation = null,
  variantId = "B01",
} = {}) {
  const categoryRank = Number(evaluation?.categoryRank);
  if (Number.isFinite(categoryRank)) {
    return clamp((categoryRank + 1) / 9);
  }
  const ranks = holeCards.map(parseRank).filter((rank) => rank > 0).sort((a, b) => b - a);
  const highCard = ranks[0] ?? 2;
  const secondCard = ranks[1] ?? 2;
  const pairScore = highestPairScore(holeCards);
  const suitedCredit = suitedness(holeCards) >= 0.5 ? 0.08 : 0;
  const connectedCredit = ranks.length >= 2 && Math.abs(ranks[0] - ranks[1]) <= 2 ? 0.06 : 0;
  const normalizedVariantId = String(variantId ?? "").toLowerCase();
  const omahaWrapCredit = normalizedVariantId.includes("plo") || ["b05", "b06", "b07", "b08", "b09"].includes(normalizedVariantId)
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
} = {}) {
  const policy = tierPolicy(tierConfig);
  const normalizedStrength = clamp(Number(strength) || 0);
  const lateStreet = ["TURN", "RIVER", "FIFTH", "SIXTH", "SEVENTH"].includes(String(street).toUpperCase());
  const callThreshold = clamp(policy.callThreshold + (lateStreet ? 0.04 : 0), 0.05, 0.95);
  const openThreshold = clamp(policy.openThreshold + (lateStreet ? 0.02 : 0), 0.05, 0.95);
  const raiseThreshold = clamp(policy.raiseThreshold - policy.bluffCredit * 0.25, 0.1, 0.98);
  const amount = Math.max(0, Number(betAmount) || 0);

  if (toCall > 0) {
    if (normalizedStrength < callThreshold) {
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
