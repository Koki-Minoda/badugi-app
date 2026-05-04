import { evaluateNlhHand, compareNlhHands } from "../../nlh/utils/nlhEvaluator.js";

function combinations(items = [], size = 0) {
  if (size === 0) return [[]];
  if (!Array.isArray(items) || items.length < size) return [];
  const result = [];
  const walk = (start, combo) => {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i <= items.length - (size - combo.length); i += 1) {
      combo.push(items[i]);
      walk(i + 1, combo);
      combo.pop();
    }
  };
  walk(0, []);
  return result;
}

function normalizePloInput(input = {}) {
  const holeCards = input.holeCards ?? input.hole ?? [];
  const boardCards = input.boardCards ?? input.board ?? [];
  if (!Array.isArray(holeCards) || holeCards.length < 4) {
    throw new Error("evaluatePloHand requires at least 4 hole cards");
  }
  if (!Array.isArray(boardCards) || boardCards.length < 3) {
    throw new Error("evaluatePloHand requires at least 3 board cards");
  }
  return {
    holeCards,
    boardCards,
  };
}

export function evaluatePloHand(input = {}) {
  const { holeCards, boardCards } = normalizePloInput(input);
  const holeCombos = combinations(holeCards, 2);
  const boardCombos = combinations(boardCards, 3);
  let best = null;
  let bestSource = null;

  for (const holeCombo of holeCombos) {
    for (const boardCombo of boardCombos) {
      const evaluation = evaluateNlhHand({ cards: [...holeCombo, ...boardCombo] });
      if (!best || compareNlhHands(evaluation, best) < 0) {
        best = evaluation;
        bestSource = {
          holeCardsUsed: [...holeCombo],
          boardCardsUsed: [...boardCombo],
        };
      }
    }
  }

  return {
    ...best,
    evaluator: "omahaHigh",
    mustUseHoleCards: 2,
    mustUseBoardCards: 3,
    holeCardsUsed: bestSource?.holeCardsUsed ?? [],
    boardCardsUsed: bestSource?.boardCardsUsed ?? [],
  };
}

export function comparePloHands(aEval, bEval) {
  return compareNlhHands(aEval, bEval);
}

export default evaluatePloHand;
