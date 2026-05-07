import { evaluateBadugi } from "../../../games/badugi/utils/badugiEvaluator.js";
import {
  clampConfidence,
  getMaxDiscardCount,
  hasLegalAction,
  normalizeLegalActions,
  sanitizeDiscardIndexes,
} from "../strategyUtils.js";

export function chooseBadugiProStrategy({
  snapshot = {},
  legalActions = [],
  actor = null,
} = {}) {
  const hand = Array.isArray(actor?.hand) ? actor.hand : [];
  const evaluation = evaluateBadugi(hand);
  const maxDiscardCount = getMaxDiscardCount({ legalActions, hand });
  const drawRound = Number(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? 0) || 0;
  const isDrawPhase = String(snapshot?.street ?? snapshot?.phase ?? "").toUpperCase() === "DRAW";
  const toCall = Math.max(
    0,
    Number(
      snapshot?.toCall ??
        actor?.toCall ??
        ((snapshot?.currentBet ?? 0) - (actor?.betThisRound ?? 0)),
    ) || 0,
  );
  const canCheck = hasLegalAction(legalActions, "CHECK");
  const canCall = hasLegalAction(legalActions, "CALL");
  const canRaise = hasLegalAction(legalActions, "RAISE");
  const canBet = hasLegalAction(legalActions, "BET");
  const normalizedLegal = normalizeLegalActions(legalActions);
  const finalRound = drawRound >= 3;
  const expensiveCall = toCall >= Math.max(40, (actor?.stack ?? 0) * 0.25);
  const strongMade = evaluation.count >= 4 && evaluation.kicker <= 7;
  const mediumMade = evaluation.count >= 4 && evaluation.kicker <= 10;
  const weakMade = evaluation.count >= 4 && evaluation.kicker > 10;
  const strongThreeCard = evaluation.count === 3 && evaluation.kicker <= 7;
  const playableThreeCard = evaluation.count === 3 && evaluation.kicker <= 9;
  const weakDraw = evaluation.count < 4 || evaluation.kicker >= 10;

  if (isDrawPhase && hasLegalAction(legalActions, "DRAW")) {
    if (evaluation.count >= 4) {
      return {
        type: "DRAW",
        discardIndexes: [],
        confidence: 0.96,
        reason: "made-badugi-pat",
      };
    }

    if (evaluation.count === 3) {
      const discardIndexes = sanitizeDiscardIndexes(
        hand
          .map((_, index) => index)
          .filter((index) => !(evaluation.activeCards ?? []).includes(hand[index])),
        1,
        hand.length,
      );
      return {
        type: "DRAW",
        discardIndexes,
        confidence: 0.84,
        reason: "three-card-badugi-draw-one",
      };
    }

    return {
      type: "DRAW",
      discardIndexes: sanitizeDiscardIndexes(
        hand
          .map((card, index) => ({ index, card }))
          .sort((left, right) => String(right.card).localeCompare(String(left.card)))
          .map((entry) => entry.index),
        maxDiscardCount,
        hand.length,
      ),
      confidence: 0.72,
      reason: "weak-badugi-redraw",
    };
  }

  if (strongMade && canRaise && (toCall > 0 || !canBet)) {
    return {
      type: "RAISE",
      confidence: clampConfidence(finalRound ? 0.9 : 0.76),
      reason: finalRound ? "strong-made-value-raise" : "strong-made-pressure-raise",
    };
  }

  if (!toCall && canBet && strongMade) {
    return {
      type: "BET",
      confidence: 0.78,
      reason: "made-badugi-open-value-bet",
    };
  }

  if (!toCall && canBet && mediumMade && finalRound) {
    return {
      type: "BET",
      confidence: 0.72,
      reason: "final-round-medium-badugi-value-bet",
    };
  }

  if (finalRound && weakMade) {
    if (canCheck) {
      return {
        type: "CHECK",
        confidence: 0.76,
        reason: "final-round-weak-made-check",
      };
    }
    if (toCall > 0 && canCall && !expensiveCall) {
      return {
        type: "CALL",
        confidence: 0.6,
        reason: "final-round-weak-made-catch-call",
      };
    }
  }

  if (finalRound && weakDraw) {
    if (canCheck) {
      return {
        type: "CHECK",
        confidence: 0.8,
        reason: "final-round-no-spew-check",
      };
    }
    if (toCall > 0 && canCall && !expensiveCall && strongThreeCard) {
      return {
        type: "CALL",
        confidence: 0.66,
        reason: "final-round-three-card-defend-call",
      };
    }
    if (toCall > 0 && hasLegalAction(legalActions, "FOLD")) {
      return {
        type: "FOLD",
        confidence: 0.82,
        reason: "final-round-weak-draw-fold",
      };
    }
  }

  if (toCall > 0 && strongThreeCard && canCall && !expensiveCall) {
    return {
      type: "CALL",
      confidence: 0.68,
      reason: "three-card-badugi-defend-call",
    };
  }

  if (toCall > 0 && playableThreeCard && canCall && !expensiveCall && finalRound) {
    return {
      type: "CALL",
      confidence: 0.6,
      reason: "final-round-playable-three-card-call",
    };
  }

  if (!toCall && strongThreeCard && canCheck) {
    return {
      type: "CHECK",
      confidence: 0.72,
      reason: "three-card-badugi-check-behind",
    };
  }

  if (toCall > 0 && weakDraw && expensiveCall) {
    if (hasLegalAction(legalActions, "FOLD")) {
      return {
        type: "FOLD",
        confidence: 0.82,
        reason: "badugi-expensive-call-fold",
      };
    }
    if (canCall) {
      return {
        type: "CALL",
        confidence: 0.58,
        reason: "badugi-expensive-call-last-resort",
      };
    }
  }

  if (toCall > 0 && weakDraw && canCall && !expensiveCall && normalizedLegal.some((entry) => entry.type === "CALL")) {
    return {
      type: "CALL",
      confidence: 0.58,
      reason: "badugi-cheap-draw-call",
    };
  }

  if (weakDraw && canCheck) {
    return {
      type: "CHECK",
      confidence: 0.68,
      reason: "weak-draw-check-behind",
    };
  }

  if (mediumMade && canCheck) {
    return {
      type: "CHECK",
      confidence: 0.62,
      reason: "medium-badugi-pot-control-check",
    };
  }

  return null;
}
