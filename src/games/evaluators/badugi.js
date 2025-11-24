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

function encodeRankValues(values = []) {
  return values.reduce((acc, val, idx) => acc + val * Math.pow(20, idx), 0);
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
  const rawCards = parsed.map((card) => card.raw ?? `${card.rank}${card.suit}`);
  const evaluation = evaluateBadugi(rawCards);
  const rankValuesDesc =
    evaluation.rankValuesDesc && evaluation.rankValuesDesc.length
      ? evaluation.rankValuesDesc
      : [...evaluation.ranks].reverse();
  const baseKey = encodeRankValues(rankValuesDesc);
  const sizePenalty = (4 - (evaluation.count ?? 0)) * SIZE_WEIGHT;
  const preferHigh = mode === "high";
  const baseScore = preferHigh ? MAX_KEY - baseKey : baseKey;
  const score = sizePenalty + baseScore;
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
