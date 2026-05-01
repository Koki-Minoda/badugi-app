import { combinations, parseCards } from "./core.js";

const PENALTY_PAIR = 1_000_000;
const PENALTY_STRAIGHT = 2_000_000;
const PENALTY_FLUSH = 4_000_000;
const CATEGORY_WEIGHT = 10_000_000;

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

function rankCounts(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
}

function detectHighStraight(values) {
  if (!values || values.length < 5) return { isStraight: false, high: null };
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) return { isStraight: false, high: null };
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    if (window.every((val, idx, arr) => idx === 0 || arr[idx - 1] - val === 1)) {
      return { isStraight: true, high: window[0] };
    }
  }
  return { isStraight: false, high: null };
}

function classifyLowHand({ values, cards, variant }) {
  const sortedRanks = normalizeRankList(values);
  const counts = rankCounts(values);
  const flush = detectFlush(cards);
  const straightInfo = variant === "27" ? detectHighStraight(values) : { isStraight: false, high: null };
  const straight = straightInfo.isStraight;
  const countPattern = counts.map((item) => item.count).sort((a, b) => b - a).join("-");

  const kickers = (excludedRanks = []) => {
    const excluded = new Set(excludedRanks);
    return sortedRanks.filter((rank) => !excluded.has(rank));
  };

  if (variant === "27" && straight && flush) {
    return { category: 8, categoryName: "straightFlush", tieRanks: [straightInfo.high], penalty: PENALTY_STRAIGHT + PENALTY_FLUSH };
  }
  if (countPattern === "4-1") {
    const quad = counts.find((item) => item.count === 4).rank;
    return { category: variant === "27" ? 7 : 5, categoryName: "quads", tieRanks: [quad, ...kickers([quad])], penalty: PENALTY_PAIR };
  }
  if (countPattern === "3-2") {
    const trip = counts.find((item) => item.count === 3).rank;
    const pair = counts.find((item) => item.count === 2).rank;
    return { category: variant === "27" ? 6 : 4, categoryName: "fullHouse", tieRanks: [trip, pair], penalty: PENALTY_PAIR };
  }
  if (variant === "27" && flush) {
    return { category: 5, categoryName: "flush", tieRanks: sortedRanks, penalty: PENALTY_FLUSH };
  }
  if (variant === "27" && straight) {
    return { category: 4, categoryName: "straight", tieRanks: [straightInfo.high], penalty: PENALTY_STRAIGHT };
  }
  if (countPattern === "3-1-1") {
    const trip = counts.find((item) => item.count === 3).rank;
    return { category: 3, categoryName: "trips", tieRanks: [trip, ...kickers([trip])], penalty: PENALTY_PAIR };
  }
  if (countPattern === "2-2-1") {
    const pairs = counts
      .filter((item) => item.count === 2)
      .map((item) => item.rank)
      .sort((a, b) => b - a);
    return { category: 2, categoryName: "twoPair", tieRanks: [...pairs, ...kickers(pairs)], penalty: PENALTY_PAIR };
  }
  if (countPattern === "2-1-1-1") {
    const pair = counts.find((item) => item.count === 2).rank;
    return { category: 1, categoryName: "onePair", tieRanks: [pair, ...kickers([pair])], penalty: PENALTY_PAIR };
  }
  return { category: 0, categoryName: "highCard", tieRanks: sortedRanks, penalty: 0 };
}

function normalizeRankList(values) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted;
}

function rankToDisplay(rank) {
  if (rank === 14 || rank === 1) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  if (rank === 10) return "10";
  return String(rank);
}

export function formatLowHandLabel(evaluation, { lowType = "27" } = {}) {
  const ranks = evaluation?.metadata?.ranks;
  if (!Array.isArray(ranks) || ranks.length === 0) {
    return lowType === "A5" || lowType === "a5" ? "A-5 Low Invalid" : "2-7 Low Invalid";
  }
  const prefix = lowType === "A5" || lowType === "a5" ? "A-5 Low" : "2-7 Low";
  return `${prefix} ${ranks.map(rankToDisplay).join("-")}`;
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
    const classification = classifyLowHand({ values: normalized, cards: combo, variant });
    const sortedRanks = normalizeRankList(normalized);
    const score = classification.category * CATEGORY_WEIGHT + encodeLowRanks(classification.tieRanks);
    if (!best || score < best.rankPrimary) {
      best = {
        rankPrimary: score,
        rankSecondary: null,
        isValid: normalized.length > 0,
        handName: variant === "27" ? "2-7 Low" : "A-5 Low",
        metadata: {
          ranks: sortedRanks,
          cards: combo.map((card) => card.raw),
          category: classification.categoryName,
          categoryRank: classification.category,
          tieRanks: classification.tieRanks,
          penalty: classification.penalty,
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
    const qualifies = highest <= requireQualifier;
    best = {
      ...best,
      qualifies,
      metadata: {
        ...best.metadata,
        qualifies,
        qualifier: requireQualifier,
      },
    };
    if (highest > requireQualifier) {
      return {
        ...best,
        rankSecondary: Number.POSITIVE_INFINITY,
      };
    }
  }
  return best;
}
