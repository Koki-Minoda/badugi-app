import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateHighHand } from "../../evaluators/high.js";
import { evaluateLowHand } from "../../evaluators/low.js";
import { comparePloHands, evaluatePloHand } from "../../plo/utils/ploEvaluator.js";

const DRAMAHA_VARIANT_CONFIG = {
  dramaha_hi: { label: "Dramaha Hi", drawMode: "high" },
  dramaha_27: { label: "Dramaha 2-7", drawMode: "low27" },
  dramaha_a5: { label: "Dramaha A-5", drawMode: "lowA5" },
  dramaha_zero: { label: "Dramaha Zero", drawMode: "zero" },
  dramaha_hidugi: { label: "Dramaha Hidugi", drawMode: "badugiHigh" },
  dramaha_badugi: { label: "Dramaha Badugi", drawMode: "badugiLow" },
};

function evaluateZeroHand(cards = []) {
  const high = evaluateHighHand({ cards });
  const ranks = Array.isArray(high.metadata?.ranks) ? high.metadata.ranks : [];
  const zeroScore = ranks.reduce((sum, rank) => {
    if (rank >= 1 && rank <= 5) return sum;
    return sum + rank;
  }, 0);
  return {
    rankPrimary: zeroScore * 1_000_000 + (high.rankPrimary ?? 0),
    rankSecondary: null,
    handName: "Zero",
    isValid: high.isValid,
    metadata: {
      ...(high.metadata ?? {}),
      zeroScore,
    },
  };
}

export function evaluateDramahaDrawHand(cards = [], variant = "dramaha_hi") {
  const mode = DRAMAHA_VARIANT_CONFIG[variant]?.drawMode ?? "high";
  switch (mode) {
    case "low27":
      return evaluateLowHand({ cards, lowType: "27" });
    case "lowA5":
      return evaluateLowHand({ cards, lowType: "A5" });
    case "zero":
      return evaluateZeroHand(cards);
    case "badugiHigh":
      return evaluateBadugiHand({ cards, mode: "high" });
    case "badugiLow":
      return evaluateBadugiHand({ cards, mode: "low" });
    case "high":
    default:
      return evaluateHighHand({ cards });
  }
}

export function compareDrawEvaluations(aEval, bEval) {
  if (!aEval && !bEval) return 0;
  if (!aEval) return 1;
  if (!bEval) return -1;
  return (aEval.rankPrimary ?? Number.POSITIVE_INFINITY) -
    (bEval.rankPrimary ?? Number.POSITIVE_INFINITY);
}

export function evaluateDramahaHand({
  holeCards = [],
  boardCards = [],
  variant = "dramaha_hi",
} = {}) {
  return {
    variant,
    label: DRAMAHA_VARIANT_CONFIG[variant]?.label ?? "Dramaha",
    board: evaluatePloHand({ holeCards, boardCards }),
    draw: evaluateDramahaDrawHand(holeCards, variant),
  };
}

export function compareDramahaBoard(aEval, bEval) {
  return comparePloHands(aEval?.board, bEval?.board);
}

export function compareDramahaDraw(aEval, bEval) {
  return compareDrawEvaluations(aEval?.draw, bEval?.draw);
}

export function getDramahaVariantConfig(variant) {
  return DRAMAHA_VARIANT_CONFIG[variant] ?? DRAMAHA_VARIANT_CONFIG.dramaha_hi;
}
