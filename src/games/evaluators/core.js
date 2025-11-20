const RANK_SYMBOLS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_TO_VALUE = Object.fromEntries(RANK_SYMBOLS.map((symbol, idx) => [symbol, idx + 2]));
const VALUE_TO_SYMBOL = Object.fromEntries(Object.entries(RANK_TO_VALUE).map(([k, v]) => [v, k]));
const BASE = 16;

function normalizeRankPart(card) {
  const rankPart = card.slice(0, -1).toUpperCase();
  if (RANK_TO_VALUE[rankPart]) return rankPart;
  if (rankPart === "T") return "10";
  return rankPart;
}

export function parseCard(card) {
  if (!card || typeof card !== "string") {
    throw new Error(`Invalid card: ${card}`);
  }
  const trimmed = card.trim().toUpperCase();
  const suit = trimmed.slice(-1);
  const rank = normalizeRankPart(trimmed);
  const value = RANK_TO_VALUE[rank];
  if (!value || !"CDHS".includes(suit)) {
    throw new Error(`Unsupported card notation: ${card}`);
  }
  return { raw: card, rank, suit, value };
}

export function parseCards(cards = []) {
  return cards.map(parseCard);
}

export function combinations(items, k) {
  const results = [];
  const m = items.length;
  if (k > m || k <= 0) return results;
  const choose = (start, acc) => {
    if (acc.length === k) {
      results.push(acc.slice());
      return;
    }
    for (let i = start; i < m; i += 1) {
      acc.push(items[i]);
      choose(i + 1, acc);
      acc.pop();
    }
  };
  choose(0, []);
  return results;
}

export function encodeRanksDescending(ranks = []) {
  return ranks.reduce((acc, val) => acc * BASE + (BASE - 1 - val), 0);
}

export function encodeRanksAscending(ranks = []) {
  return ranks.reduce((acc, val) => acc * BASE + val, 0);
}

export function valuesDescending(cards) {
  return cards
    .map((card) => card.value)
    .sort((a, b) => b - a);
}

export function uniqueValuesDescending(cards) {
  const seen = new Set();
  const list = [];
  for (const card of cards.sort((a, b) => b.value - a.value)) {
    if (!seen.has(card.value)) {
      seen.add(card.value);
      list.push(card.value);
    }
  }
  return list;
}

export function isFlush(cards) {
  return new Set(cards.map((card) => card.suit)).size === 1;
}

export function detectStraight(values) {
  if (!values || values.length < 5) return { isStraight: false, high: null };
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) return { isStraight: false, high: null };
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    if (window.every((val, idx, arr) => idx === 0 || arr[idx - 1] - val === 1)) {
      return { isStraight: true, high: window[0] };
    }
  }
  // Wheel (A-2-3-4-5)
  if (unique.includes(14) && unique.slice(-4).join(",") === "5,4,3,2") {
    return { isStraight: true, high: 5 };
  }
  return { isStraight: false, high: null };
}

export function compareRankArraysAsc(a = [], b = []) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const va = a[i] ?? Number.POSITIVE_INFINITY;
    const vb = b[i] ?? Number.POSITIVE_INFINITY;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function compareRankArraysDesc(a = [], b = []) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const va = a[i] ?? Number.NEGATIVE_INFINITY;
    const vb = b[i] ?? Number.NEGATIVE_INFINITY;
    if (va !== vb) return vb - va;
  }
  return 0;
}

export function toRankSymbols(values = []) {
  return values.map((val) => VALUE_TO_SYMBOL[val] ?? val);
}

export function generateScore(categoryRank, ranks, { invert = true } = {}) {
  let score = categoryRank;
  for (const rank of ranks) {
    const value = invert ? BASE - 1 - rank : rank;
    score = score * BASE + value;
  }
  return score;
}
