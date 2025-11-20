import { combinations, detectStraight, parseCards } from "./core.js";

const PENALTY_PAIR = 1_000_000;
const PENALTY_STRAIGHT = 2_000_000;
const PENALTY_FLUSH = 4_000_000;

function normalizeValues(cards, variant) {
  return cards.map((card) => {
    if (variant === "a5" && card.value === 14) {
      return 1;
    }
    return card.value;
  });
}

function detectFlush(cards) {
  return new Set(cards.map((card) => card.suit)).size === 1;
}

function encodeLowRanks(ranks) {
  const BASE = 16;
  return ranks.reduce((acc, rank) => acc * BASE + rank, 0);
}

function normalizeRankList(values) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted;
}

export function evaluateLowHand({
  cards = [],
  lowType = "27",
  requireQualifier = null,
} = {}) {
  const variant = lowType === "A5" || lowType === "a5" ? "a5" : "27";
  const parsed = parseCards(cards);
  if (parsed.length < 5) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      handName: "Invalid Low",
      isValid: false,
      metadata: {},
    };
  }

  let best = null;
  for (const combo of combinations(parsed, 5)) {
    const normalized = normalizeValues(combo, variant);
    const sortedRanks = normalizeRankList(normalized);
    const unique = new Set(normalized);
    let penalty = 0;
    if (unique.size < 5) {
      penalty += PENALTY_PAIR;
    }
    const straightInfo = detectStraight(
      normalized.map((val) => (val === 1 ? 14 : val))
    );
    const straight = straightInfo.isStraight;
    const flush = detectFlush(combo);
    if (variant === "27") {
      if (straight) penalty += PENALTY_STRAIGHT;
      if (flush) penalty += PENALTY_FLUSH;
    }
    if (variant === "a5" && unique.size < 5) {
      penalty += PENALTY_PAIR;
    }

    const score = penalty * 1_000_000 + encodeLowRanks(sortedRanks);
    if (!best || score < best.rankPrimary) {
      best = {
        rankPrimary: score,
        rankSecondary: null,
        isValid: unique.size > 0,
        handName: variant === "27" ? "2-7 Low" : "A-5 Low",
        metadata: {
          ranks: sortedRanks,
          cards: combo.map((card) => card.raw),
          penalty,
        },
      };
    }
  }

  if (!best) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      rankSecondary: null,
      isValid: false,
      handName: "Invalid Low",
      metadata: {},
    };
  }

  if (requireQualifier != null) {
    const highest = best.metadata.ranks[0];
    if (highest > requireQualifier) {
      return {
        ...best,
        rankSecondary: Number.POSITIVE_INFINITY,
        qualifies: false,
      };
    }
  }
  return best;
}
