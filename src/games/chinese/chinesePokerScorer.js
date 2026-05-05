import { parseCards, toRankSymbols } from "../evaluators/core.js";
import { evaluateHighHand } from "../evaluators/high.js";

const FRONT_CATEGORY_RANK = {
  trips: 5,
  pair: 7,
  high: 8,
};

export function compareChineseScore(a, b) {
  if (a.rankPrimary !== b.rankPrimary) return a.rankPrimary - b.rankPrimary;
  const aRanks = a.metadata?.ranks ?? [];
  const bRanks = b.metadata?.ranks ?? [];
  const len = Math.max(aRanks.length, bRanks.length);
  for (let idx = 0; idx < len; idx += 1) {
    const av = aRanks[idx] ?? 0;
    const bv = bRanks[idx] ?? 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

export function evaluateFrontHand(cards = []) {
  const parsed = parseCards(cards);
  if (parsed.length !== 3) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      handName: "Invalid Front",
      isValid: false,
      metadata: { category: null, ranks: [] },
    };
  }
  const counts = new Map();
  parsed.forEach((card) => {
    counts.set(card.value, (counts.get(card.value) ?? 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const category = entries[0][1] === 3 ? "trips" : entries[0][1] === 2 ? "pair" : "high";
  const ranks = [
    ...entries.flatMap(([value, count]) => new Array(count).fill(value)),
  ].slice(0, 3);
  const paddedRanks = [...ranks, 0, 0].slice(0, 5);
  const rankPrimary =
    FRONT_CATEGORY_RANK[category] * 16 ** 5 +
    paddedRanks.reduce((score, rank) => score * 16 + (15 - rank), 0);
  const label =
    category === "trips"
      ? `Trips ${toRankSymbols([ranks[0]])[0]}`
      : category === "pair"
      ? `Pair ${toRankSymbols([ranks[0]])[0]}`
      : `High ${toRankSymbols([ranks[0]])[0]}`;
  return {
    rankPrimary,
    rankSecondary: null,
    handName: label,
    isValid: true,
    metadata: {
      category,
      ranks,
      cards: parsed.map((card) => card.raw),
    },
  };
}

export function evaluateChineseRows({ front = [], middle = [], back = [] } = {}) {
  const frontEval = evaluateFrontHand(front);
  const middleEval = evaluateHighHand({ cards: middle });
  const backEval = evaluateHighHand({ cards: back });
  const middleBeatsBack = compareChineseScore(middleEval, backEval) < 0;
  const frontBeatsMiddle = compareChineseScore(frontEval, middleEval) < 0;
  const foulReasons = [];
  if (!frontEval.isValid || !middleEval.isValid || !backEval.isValid) {
    foulReasons.push("invalid-row-size");
  }
  if (middleBeatsBack) foulReasons.push("middle-beats-back");
  if (frontBeatsMiddle) foulReasons.push("front-beats-middle");
  return {
    front: frontEval,
    middle: middleEval,
    back: backEval,
    foul: foulReasons.length > 0,
    foulReasons,
    royalties: calculateRoyalties({ front: frontEval, middle: middleEval, back: backEval }),
  };
}

export function calculateRoyalties({ front, middle, back } = {}) {
  let total = 0;
  const details = [];
  if (front?.metadata?.category === "trips") {
    total += 10;
    details.push({ row: "front", type: "trips", points: 10 });
  } else if (front?.metadata?.category === "pair") {
    const pairRank = front.metadata.ranks?.[0] ?? 0;
    if (pairRank >= 6) {
      const points = pairRank - 5;
      total += points;
      details.push({ row: "front", type: "pair", points });
    }
  }
  for (const [row, evaluation] of [
    ["middle", middle],
    ["back", back],
  ]) {
    const category = evaluation?.metadata?.category;
    if (category === "four-of-a-kind") {
      total += row === "middle" ? 20 : 10;
      details.push({ row, type: category, points: row === "middle" ? 20 : 10 });
    }
    if (category === "straight-flush") {
      total += row === "middle" ? 30 : 15;
      details.push({ row, type: category, points: row === "middle" ? 30 : 15 });
    }
  }
  return { total, details };
}

export default evaluateChineseRows;
