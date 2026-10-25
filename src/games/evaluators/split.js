import { evaluateHighHand } from "./high.js";
import { evaluateBadugiHand } from "./badugi.js";
import { evaluateLowHand, formatLowHandLabel } from "./low.js";

function evaluateLabeledLow(cards, lowType) {
  const evaluation = evaluateLowHand({ cards, lowType });
  return { ...evaluation, handName: formatLowHandLabel(evaluation, { lowType }) };
}

export function evaluateSplitHand({
  cards = [],
  highEvaluator = evaluateHighHand,
  lowEvaluator = evaluateLowHand,
  lowOptions = {},
} = {}) {
  const highResult = highEvaluator({ cards });
  const lowResult = lowEvaluator({ cards, ...lowOptions });
  const qualifies =
    lowResult.rankPrimary !== Number.POSITIVE_INFINITY &&
    lowResult.qualifies !== false;
  return {
    rankPrimary: highResult.rankPrimary,
    rankSecondary: qualifies ? lowResult.rankPrimary : Number.POSITIVE_INFINITY,
    handName: `${highResult.handName} / ${qualifies ? lowResult.handName : "No Low"}`,
    isValid: highResult.isValid,
    metadata: {
      high: highResult,
      low: lowResult,
    },
  };
}

export function evaluateBadeucey(params = {}) {
  return evaluateSplitHand({
    ...params,
    highEvaluator: ({ cards }) => evaluateBadugiHand({ cards, aceHigh: true }),
    lowEvaluator: ({ cards }) => evaluateLabeledLow(cards, "27"),
  });
}

export function evaluateBadacey(params = {}) {
  return evaluateSplitHand({
    ...params,
    highEvaluator: evaluateBadugiHand,
    lowEvaluator: ({ cards }) => evaluateLabeledLow(cards, "A5"),
  });
}

export function evaluateArchieHigh({ cards = [] } = {}) {
  const evaluation = evaluateHighHand({ cards });
  const category = evaluation.metadata?.category;
  const qualifies = [
    "one-pair", "two-pair", "three-of-a-kind", "straight", "flush",
    "full-house", "four-of-a-kind", "straight-flush",
  ].includes(category) && (category !== "one-pair" || (evaluation.metadata?.ranks?.[0] ?? 0) >= 9);
  return { ...evaluation, qualifies, rankPrimary: qualifies ? evaluation.rankPrimary : Number.POSITIVE_INFINITY };
}

export function evaluateArchieLow({ cards = [] } = {}) {
  const evaluation = evaluateLowHand({ cards, lowType: "A5", requireQualifier: 8 });
  return { ...evaluation, handName: formatLowHandLabel(evaluation, { lowType: "A5" }) };
}

export function evaluateArchie({ cards = [] } = {}) {
  const high = evaluateArchieHigh({ cards });
  const low = evaluateArchieLow({ cards });
  return {
    rankPrimary: high.rankPrimary,
    rankSecondary: low.rankPrimary,
    handName: `${high.handName} / ${low.handName}`,
    isValid: high.isValid || low.isValid,
    metadata: { components: { archieHigh: high, archieLow: low }, splitMode: "component" },
  };
}

export function evaluateHiLoEight(params = {}) {
  return evaluateSplitHand({
    ...params,
    highEvaluator: evaluateHighHand,
    lowEvaluator: ({ cards }) =>
      evaluateLowHand({ cards, lowType: "A5", requireQualifier: 8 }),
  });
}
