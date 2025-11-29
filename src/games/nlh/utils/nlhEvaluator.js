// src/games/nlh/utils/nlhEvaluator.js

import {
  parseCard,
  combinations,
  detectStraight,
  isFlush,
  compareRankArraysDesc,
  encodeRanksDescending,
} from "../../evaluators/core.js";

const CATEGORY_ORDER = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH",
];

const CATEGORY_TO_RANK = Object.fromEntries(
  CATEGORY_ORDER.map((name, idx) => [name, idx]),
);

function normalizeCards(inputCards = []) {
  if (!Array.isArray(inputCards) || inputCards.length < 5) {
    throw new Error("evaluateNlhHand requires at least 5 cards");
  }
  return inputCards.map((card) => {
    if (typeof card === "string") {
      return parseCard(card);
    }
    if (card && typeof card === "object") {
      if (card.raw) {
        return parseCard(card.raw);
      }
      if (card.rank && card.suit) {
        return parseCard(`${card.rank}${card.suit}`);
      }
    }
    throw new Error(`Unsupported card input: ${card}`);
  });
}

function sortedCardsDesc(cards) {
  return [...cards].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.suit.localeCompare(b.suit);
  });
}

function analyzeCounts(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
  }
  const entries = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const bucket = (n) => entries.filter(([, count]) => count === n).map(([value]) => value);
  return {
    entries,
    quads: bucket(4),
    trips: bucket(3),
    pairs: bucket(2),
    singles: bucket(1),
  };
}

function buildEvaluation({
  category,
  primaryRanks = [],
  kickerRanks = [],
  cards,
}) {
  const categoryRank = CATEGORY_TO_RANK[category];
  const rankDescriptor = encodeRanksDescending([...primaryRanks, ...kickerRanks]);
  const orderedCards = sortedCardsDesc(cards);
  return {
    isValid: true,
    category,
    categoryRank,
    primaryRanks,
    kickerRanks,
    rankPrimary: categoryRank,
    rankSecondary: rankDescriptor,
    best5: orderedCards.map((card) => card.raw),
    key: `${category}|${primaryRanks.join("-")}${kickerRanks.length ? `|${kickerRanks.join("-")}` : ""}`,
  };
}

function evaluateFiveCardHand(cards) {
  const ordered = sortedCardsDesc(cards);
  const valuesDesc = ordered.map((card) => card.value);
  const flush = isFlush(ordered);
  const straightInfo = detectStraight(valuesDesc);
  const counts = analyzeCounts(ordered);

  if (flush && straightInfo.isStraight) {
    return buildEvaluation({
      category: "STRAIGHT_FLUSH",
      primaryRanks: [straightInfo.high],
      kickerRanks: [],
      cards: ordered,
    });
  }

  if (counts.quads.length === 1) {
    const quadValue = counts.quads[0];
    const kicker = counts.singles[0] ?? counts.pairs[0];
    return buildEvaluation({
      category: "FOUR_OF_A_KIND",
      primaryRanks: [quadValue],
      kickerRanks: [kicker],
      cards: ordered,
    });
  }

  if (counts.trips.length >= 1 && (counts.pairs.length >= 1 || counts.trips.length >= 2)) {
    const tripValue = counts.trips[0];
    const pairValue = counts.pairs[0] ?? counts.trips[1];
    return buildEvaluation({
      category: "FULL_HOUSE",
      primaryRanks: [tripValue],
      kickerRanks: [pairValue],
      cards: ordered,
    });
  }

  if (flush) {
    return buildEvaluation({
      category: "FLUSH",
      primaryRanks: valuesDesc,
      kickerRanks: [],
      cards: ordered,
    });
  }

  if (straightInfo.isStraight) {
    return buildEvaluation({
      category: "STRAIGHT",
      primaryRanks: [straightInfo.high],
      kickerRanks: [],
      cards: ordered,
    });
  }

  if (counts.trips.length >= 1) {
    const tripValue = counts.trips[0];
    const kickers = counts.singles.slice(0, 2);
    return buildEvaluation({
      category: "THREE_OF_A_KIND",
      primaryRanks: [tripValue],
      kickerRanks: kickers,
      cards: ordered,
    });
  }

  if (counts.pairs.length >= 2) {
    const [highPair, lowPair] = counts.pairs.slice(0, 2);
    const kicker = counts.singles[0] ?? counts.pairs[2];
    return buildEvaluation({
      category: "TWO_PAIR",
      primaryRanks: [highPair, lowPair],
      kickerRanks: [kicker],
      cards: ordered,
    });
  }

  if (counts.pairs.length === 1) {
    const pairValue = counts.pairs[0];
    const kickers = counts.singles.slice(0, 3);
    return buildEvaluation({
      category: "PAIR",
      primaryRanks: [pairValue],
      kickerRanks: kickers,
      cards: ordered,
    });
  }

  return buildEvaluation({
    category: "HIGH_CARD",
    primaryRanks: valuesDesc,
    kickerRanks: [],
    cards: ordered,
  });
}

function compareEvaluations(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const categoryDiff = (b.categoryRank ?? 0) - (a.categoryRank ?? 0);
  if (categoryDiff !== 0) return categoryDiff;
  const primaryDiff = compareRankArraysDesc(a.primaryRanks, b.primaryRanks);
  if (primaryDiff !== 0) return primaryDiff;
  return compareRankArraysDesc(a.kickerRanks, b.kickerRanks);
}

export function evaluateNlhHand(input = {}) {
  const cardsArgument = Array.isArray(input) ? input : input.cards;
  if (!cardsArgument) {
    throw new Error("evaluateNlhHand requires a cards array");
  }
  const parsedCards = normalizeCards(cardsArgument);
  const combos = parsedCards.length === 5 ? [parsedCards] : combinations(parsedCards, 5);
  let best = null;
  for (const combo of combos) {
    const evaluation = evaluateFiveCardHand(combo);
    if (!best || compareEvaluations(evaluation, best) < 0) {
      best = evaluation;
    }
  }
  return {
    ...best,
    cardsUsed: best?.best5 ?? [],
    totalCards: parsedCards.length,
  };
}

export function compareNlhHands(aEval, bEval) {
  return compareEvaluations(aEval, bEval);
}

export default evaluateNlhHand;
