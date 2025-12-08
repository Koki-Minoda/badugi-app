import { evaluateBadugi, compareBadugiEvaluations } from "../utils/badugiEvaluator.js";

function normalizeEvaluation(source = null) {
  if (source && typeof source === "object" && Array.isArray(source.rankValuesDesc)) {
    return source;
  }
  if (Array.isArray(source?.hand)) {
    return evaluateBadugi(source.hand);
  }
  if (Array.isArray(source)) {
    return evaluateBadugi(source);
  }
  if (source && typeof source === "object" && Array.isArray(source.activeCards)) {
    return source;
  }
  return evaluateBadugi([]);
}

export function compareBadugiEval(left, right) {
  return compareBadugiEvaluations(normalizeEvaluation(left), normalizeEvaluation(right));
}

export function resolveBadugiWinners(contenders = []) {
  if (!Array.isArray(contenders) || contenders.length === 0) return [];
  const evaluated = contenders
    .map((entry) => {
      const evaluation = normalizeEvaluation(entry?.evaluation ?? entry);
      return {
        ...entry,
        evaluation,
      };
    })
    .sort((a, b) => compareBadugiEval(a.evaluation, b.evaluation));
  if (!evaluated.length) return [];
  const bestEval = evaluated[0].evaluation;
  return evaluated.filter((entry) => compareBadugiEval(entry.evaluation, bestEval) === 0);
}
