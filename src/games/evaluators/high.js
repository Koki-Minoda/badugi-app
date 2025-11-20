import {
  combinations,
  detectStraight,
  encodeRanksDescending,
  generateScore,
  parseCards,
} from "./core.js";

const CATEGORY_ORDER = [
  "straight-flush",
  "four-of-a-kind",
  "full-house",
  "flush",
  "straight",
  "three-of-a-kind",
  "two-pair",
  "one-pair",
  "high-card",
];

const CATEGORY_RANK = Object.fromEntries(CATEGORY_ORDER.map((name, idx) => [name, idx]));

function classifyFiveCards(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const suits = cards.map((card) => card.suit);
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts).map(([value, count]) => ({
    value: Number(value),
    count,
  }));
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.value - a.value;
  });

  const flush = new Set(suits).size === 1;
  const straightInfo = detectStraight(values);
  const straight = straightInfo.isStraight;

  if (straight && flush) {
    return {
      category: "straight-flush",
      ranks: [straightInfo.high],
      handName: straightInfo.high === 14 ? "Royal Flush" : "Straight Flush",
    };
  }
  if (entries[0].count === 4) {
    return {
      category: "four-of-a-kind",
      ranks: [entries[0].value, entries[1].value],
      handName: "Four of a Kind",
    };
  }
  if (entries[0].count === 3 && entries[1].count === 2) {
    return {
      category: "full-house",
      ranks: [entries[0].value, entries[1].value],
      handName: "Full House",
    };
  }
  if (flush) {
    return {
      category: "flush",
      ranks: values,
      handName: "Flush",
    };
  }
  if (straight) {
    return {
      category: "straight",
      ranks: [straightInfo.high],
      handName: "Straight",
    };
  }
  if (entries[0].count === 3) {
    const kickers = entries.slice(1).flatMap((entry) =>
      new Array(entry.count).fill(entry.value)
    );
    return {
      category: "three-of-a-kind",
      ranks: [entries[0].value, ...kickers],
      handName: "Three of a Kind",
    };
  }
  if (entries[0].count === 2 && entries[1].count === 2) {
    const remaining = entries
      .slice(2)
      .flatMap((entry) => new Array(entry.count).fill(entry.value));
    return {
      category: "two-pair",
      ranks: [entries[0].value, entries[1].value, ...remaining],
      handName: "Two Pair",
    };
  }
  if (entries[0].count === 2) {
    const kickers = entries.slice(1).flatMap((entry) =>
      new Array(entry.count).fill(entry.value)
    );
    return {
      category: "one-pair",
      ranks: [entries[0].value, ...kickers],
      handName: "One Pair",
    };
  }
  return {
    category: "high-card",
    ranks: values,
    handName: "High Card",
  };
}

export function evaluateHighHand({ cards = [] } = {}) {
  const parsed = parseCards(cards);
  if (parsed.length < 5) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      handName: "Invalid",
      isValid: false,
      metadata: { category: null, ranks: [] },
    };
  }
  let best = null;
  for (const combo of combinations(parsed, 5)) {
    const classification = classifyFiveCards(combo);
    const score = generateScore(
      CATEGORY_RANK[classification.category],
      classification.ranks,
      { invert: true }
    );
    if (!best || score < best.rankPrimary) {
      best = {
        rankPrimary: score,
        rankSecondary: null,
        handName: classification.handName,
        isValid: true,
        metadata: {
          category: classification.category,
          ranks: classification.ranks,
          cards: combo.map((c) => c.raw),
        },
      };
    }
  }
  return (
    best ?? {
      rankPrimary: Number.POSITIVE_INFINITY,
      handName: "Invalid",
      isValid: false,
      metadata: { category: null, ranks: [] },
    }
  );
}
