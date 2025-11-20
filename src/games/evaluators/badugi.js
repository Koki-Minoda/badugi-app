import { parseCards } from "./core.js";

const BADUGI_SIZE_LABEL = {
  4: "Badugi 4-card",
  3: "Badugi 3-card",
  2: "Badugi 2-card",
  1: "Badugi 1-card",
};

const SIZE_WEIGHT = 1_000_000;
const MAX_KEY = 20 ** 4;

function bestBadugiSubset(cards, preferHigh = false) {
  let best = null;
  const choose = (start, acc) => {
    if (acc.length === 4) {
      evaluateCandidate(acc, true);
      return;
    }
    for (let i = start; i < cards.length; i += 1) {
      acc.push(cards[i]);
      evaluateCandidate(acc, false);
      choose(i + 1, acc);
      acc.pop();
    }
  };

  function evaluateCandidate(candidate, requireUniqueLen) {
    const size = candidate.length;
    if (size === 0) return;
    const ranks = new Set();
    const suits = new Set();
    for (const card of candidate) {
      const rank = card.rank;
      const suit = card.suit;
      if (ranks.has(rank) || suits.has(suit)) return;
      ranks.add(rank);
      suits.add(suit);
    }
    if (requireUniqueLen && size !== 4) return;
    const values = candidate
      .map((card) => (card.rank === "A" ? 1 : card.value))
      .sort((a, b) => (preferHigh ? b - a : a - b));
    const key = values.reduce((acc, val, idx) => acc + val * Math.pow(20, idx), 0);
    if (!best || compareCandidates({ size, key }, best, preferHigh) < 0) {
      best = {
        size,
        key,
        values,
        cards: candidate.map((card) => card.raw),
      };
    }
  }

  choose(0, []);
  if (!best) {
    const fallback = cards[0];
    return {
      size: 1,
      values: [fallback?.value ?? 14],
      cards: [fallback?.raw ?? ""],
    };
  }
  return best;
}

function compareCandidates(a, b, preferHigh) {
  if (a.size !== b.size) {
    return b.size - a.size;
  }
  if (a.key === b.key) return 0;
  return preferHigh ? b.key - a.key : a.key - b.key;
}

export function evaluateBadugiHand({ cards = [], mode = "low" } = {}) {
  const parsed = parseCards(cards);
  if (!parsed.length) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      isValid: false,
      handName: "Invalid Badugi",
      metadata: {},
    };
  }
  const preferHigh = mode === "high";
  const subset = bestBadugiSubset(parsed, preferHigh);
  const sizePenalty = (4 - (subset.size ?? 1)) * SIZE_WEIGHT;
  const baseScore = preferHigh ? MAX_KEY - subset.key : subset.key;
  const score = sizePenalty + baseScore;
  return {
    rankPrimary: score,
    rankSecondary: null,
    handName: BADUGI_SIZE_LABEL[subset.size] ?? "Badugi",
    isValid: subset.size > 0,
    metadata: {
      ranks: subset.values,
      cards: subset.cards,
      size: subset.size,
      mode,
    },
  };
}
