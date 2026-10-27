import { parseCards } from "./core.js";
import { evaluateBadugi } from "../badugi/utils/badugiEvaluator.js";

const BADUGI_SIZE_LABEL = {
  4: "Badugi 4-card",
  3: "Badugi 3-card",
  2: "Badugi 2-card",
  1: "Badugi 1-card",
};

const SIZE_WEIGHT = 1_000_000;
const MAX_KEY = 20 ** 4;
const RANK_SYMBOLS = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function encodeRankValues(values = []) {
  return values.reduce((acc, val) => acc * 20 + val, 0);
}

export function evaluateBadugiHand({ cards = [], mode = "low", aceHigh = false } = {}) {
  const parsed = parseCards(cards);
  if (!parsed.length) {
    return {
      rankPrimary: Number.POSITIVE_INFINITY,
      isValid: false,
      handName: "Invalid Badugi",
      metadata: {},
    };
  }
  if (mode === "high") {
    // High Badugi (Hidugi) still requires distinct suits, but repeated ranks play.
    // The WSOP's best high hand is the four aces, one from each suit.
    let best = null;
    for (let mask = 1; mask < (1 << parsed.length); mask += 1) {
      const subset = parsed.filter((_, index) => mask & (1 << index));
      if (subset.length > 4 || new Set(subset.map((card) => card.suit)).size !== subset.length) continue;
      const ranks = subset.map((card) => card.value).sort((a, b) => b - a);
      const score = (4 - subset.length) * SIZE_WEIGHT + MAX_KEY - encodeRankValues(ranks);
      if (!best || score < best.rankPrimary) {
        const rankLabel = ranks.map((rank) => RANK_SYMBOLS[rank] ?? String(rank)).join("-");
        best = {
          rankPrimary: score,
          rankSecondary: null,
          handName: `Hidugi ${subset.length}-card (${rankLabel})`,
          isValid: true,
          metadata: { ranks, cards: subset.map((card) => card.raw), size: subset.length, mode },
        };
      }
    }
    return best;
  }
  if (aceHigh) {
    let best = null;
    for (let mask=1; mask<(1 << parsed.length); mask++) {
      const subset=parsed.filter((_,i)=>mask & (1 << i));
      if (subset.length>4 || new Set(subset.map(c=>c.suit)).size!==subset.length || new Set(subset.map(c=>c.value)).size!==subset.length) continue;
      const ranks=subset.map(c=>c.value).sort((a,b)=>b-a);
      const score=(4-subset.length)*SIZE_WEIGHT+encodeRankValues(ranks);
      if (!best || score<best.rankPrimary) best={rankPrimary:score,rankSecondary:null,handName:BADUGI_SIZE_LABEL[subset.length],isValid:true,metadata:{ranks:[...ranks].reverse(),cards:subset.map(c=>c.raw),size:subset.length,mode,aceHigh:true}};
    }
    return best;
  }
  const rawCards = parsed.map((card) => card.raw ?? `${card.rank}${card.suit}`);
  const evaluation = evaluateBadugi(rawCards);
  const rankValuesDesc =
    evaluation.rankValuesDesc && evaluation.rankValuesDesc.length
      ? evaluation.rankValuesDesc
      : [...evaluation.ranks].reverse();
  const baseKey = encodeRankValues(rankValuesDesc);
  const sizePenalty = (4 - (evaluation.count ?? 0)) * SIZE_WEIGHT;
  const score = sizePenalty + baseKey;
  return {
    rankPrimary: score,
    rankSecondary: null,
    handName: BADUGI_SIZE_LABEL[evaluation.count] ?? "Badugi",
    isValid: evaluation.count > 0,
    metadata: {
      ranks: evaluation.ranks,
      cards: evaluation.activeCards,
      size: evaluation.count,
      mode,
    },
  };
}
