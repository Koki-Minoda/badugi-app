import { evaluateHighHand } from "./high.js";
import { evaluateBadugiHand } from "./badugi.js";
import { evaluateLowHand } from "./low.js";

export function evaluateSplitHand({
  cards = [],
  highEvaluator = evaluateHighHand,
  lowEvaluator = evaluateLowHand,
  lowOptions = {},
} = {}) {
  const highResult = highEvaluator({ cards });
  const lowResult = lowEvaluator({ cards, ...lowOptions });
  const qualifies = lowResult.rankPrimary !== Number.POSITIVE_INFINITY;
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
    highEvaluator: evaluateBadugiHand,
    lowEvaluator: ({ cards }) => evaluateLowHand({ cards, lowType: "27" }),
  });
}

export function evaluateBadacey(params = {}) {
  return evaluateSplitHand({
    ...params,
    highEvaluator: evaluateBadugiHand,
    lowEvaluator: ({ cards }) => evaluateLowHand({ cards, lowType: "A5" }),
  });
}

export function evaluateHiLoEight(params = {}) {
  return evaluateSplitHand({
    ...params,
    highEvaluator: evaluateHighHand,
    lowEvaluator: ({ cards }) =>
      evaluateLowHand({ cards, lowType: "A5", requireQualifier: 8 }),
  });
}
