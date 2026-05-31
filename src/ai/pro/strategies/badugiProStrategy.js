import { evaluateBadugi } from "../../../games/badugi/utils/badugiEvaluator.js";
import {
  clampConfidence,
  getMaxDiscardCount,
  hasLegalAction,
  normalizeLegalActions,
  sanitizeDiscardIndexes,
} from "../strategyUtils.js";

function normalizePositionLabel(value) {
  const label = String(value ?? "").trim().toUpperCase();
  if (!label) return null;
  if (["BTN", "BUTTON", "DEALER"].includes(label)) return "BTN";
  if (["CO", "CUTOFF", "CUT_OFF"].includes(label)) return "CO";
  if (
    ["UTG", "EP", "EARLY", "EARLY_POSITION", "EARLY-POSITION"].includes(label)
  ) {
    return "EARLY";
  }
  return label;
}

function isInactiveSeat(player = null) {
  return Boolean(
    player?.folded ||
      player?.hasFolded ||
      player?.busted ||
      player?.isBusted ||
      player?.seatOut ||
      player?.sittingOut,
  );
}

function getActorSeatIndex(snapshot = {}, actor = null) {
  const candidates = [
    snapshot?.actingPlayerIndex,
    snapshot?.actorSeat,
    actor?.seatIndex,
    actor?.seat,
  ];
  const value = candidates.find((candidate) => Number.isInteger(candidate));
  return Number.isInteger(value) ? value : null;
}

function getButtonSeat(snapshot = {}) {
  const candidates = [
    snapshot?.buttonSeat,
    snapshot?.dealerSeat,
    snapshot?.dealerIdx,
    snapshot?.dealerIndex,
    snapshot?.metadata?.buttonSeat,
    snapshot?.metadata?.dealerSeat,
    snapshot?.metadata?.dealerIdx,
  ];
  const value = candidates.find((candidate) => Number.isInteger(candidate));
  return Number.isInteger(value) ? value : null;
}

function seatAfter(activeSeats, seat, offset) {
  const start = activeSeats.indexOf(seat);
  if (start < 0 || activeSeats.length === 0) return null;
  return activeSeats[(start + offset + activeSeats.length) % activeSeats.length];
}

function classifyBadugiPosition(snapshot = {}, actor = null) {
  const explicit = normalizePositionLabel(
    actor?.position ??
      actor?.positionLabel ??
      actor?.tablePosition ??
      snapshot?.position ??
      snapshot?.positionLabel ??
      snapshot?.metadata?.position,
  );
  if (explicit === "BTN" || explicit === "CO") {
    return { label: explicit, isLate: true, isEarly: false };
  }
  if (explicit === "EARLY") {
    return { label: explicit, isLate: false, isEarly: true };
  }

  const actorSeat = getActorSeatIndex(snapshot, actor);
  const buttonSeat = getButtonSeat(snapshot);
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  if (
    !Number.isInteger(actorSeat) ||
    !Number.isInteger(buttonSeat) ||
    players.length < 2
  ) {
    return { label: explicit, isLate: false, isEarly: false };
  }
  const activeSeats = players
    .map((player, seat) => ({ player, seat }))
    .filter(({ player }) => player && !isInactiveSeat(player))
    .map(({ seat }) => seat);
  if (!activeSeats.includes(actorSeat) || !activeSeats.includes(buttonSeat)) {
    return { label: explicit, isLate: false, isEarly: false };
  }
  if (actorSeat === buttonSeat) {
    return { label: "BTN", isLate: true, isEarly: false };
  }
  if (actorSeat === seatAfter(activeSeats, buttonSeat, -1)) {
    return { label: "CO", isLate: true, isEarly: false };
  }
  const orderFromButton = Array.from({ length: activeSeats.length }, (_, offset) =>
    seatAfter(activeSeats, buttonSeat, offset),
  );
  const orderIndex = orderFromButton.indexOf(actorSeat);
  const isEarly =
    activeSeats.length >= 5 &&
    orderIndex >= 3 &&
    orderIndex <= Math.max(3, activeSeats.length - 3);
  return { label: isEarly ? "EARLY" : explicit, isLate: false, isEarly };
}

function canSafelyValueRaise(snapshot = {}, legalActions = []) {
  if (!hasLegalAction(legalActions, "RAISE")) return false;
  const raiseCount =
    Number(
      snapshot?.metadata?.raiseCountThisRound ??
        snapshot?.raiseCountThisRound ??
        0,
    ) || 0;
  const raiseCap =
    Number(snapshot?.metadata?.raiseCap ?? snapshot?.raiseCap ?? 4) || 4;
  return raiseCount < raiseCap - 1;
}

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
  const canOpenAggress = canBet || (toCall === 0 && canRaise);
  const canValueRaise = canSafelyValueRaise(snapshot, legalActions);
  const position = classifyBadugiPosition(snapshot, actor);
  const normalizedLegal = normalizeLegalActions(legalActions);
  const finalRound = drawRound >= 3;
  const expensiveCall = toCall >= Math.max(40, (actor?.stack ?? 0) * 0.25);
  const strongMade = evaluation.count >= 4 && evaluation.kicker <= 7;
  const mediumMade = evaluation.count >= 4 && evaluation.kicker <= 9;
  const weakMade = evaluation.count >= 4 && evaluation.kicker > 9;
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

  if (strongMade && canRaise && canValueRaise && toCall > 0) {
    return {
      type: "RAISE",
      confidence: clampConfidence(finalRound ? 0.9 : 0.76),
      reason: finalRound ? "strong-made-value-raise" : "strong-made-pressure-raise",
    };
  }

  if (strongMade && canRaise && !canValueRaise && toCall > 0 && canCall) {
    return {
      type: "CALL",
      confidence: 0.82,
      reason: "strong-made-raise-cap-call",
    };
  }

  if (!toCall && canOpenAggress && strongMade) {
    return {
      type: canBet ? "BET" : "RAISE",
      confidence: 0.78,
      reason: "made-badugi-open-value-bet",
    };
  }

  if (!toCall && canOpenAggress && mediumMade && finalRound) {
    return {
      type: canBet ? "BET" : "RAISE",
      confidence: 0.72,
      reason: "final-round-medium-badugi-value-bet",
    };
  }

  if (
    !toCall &&
    canOpenAggress &&
    evaluation.count === 3 &&
    evaluation.kicker <= 6 &&
    drawRound <= 1 &&
    !position.isEarly
  ) {
    return {
      type: canBet ? "BET" : "RAISE",
      confidence: position.isLate ? 0.74 : 0.68,
      reason: "strong-3card-early-pressure",
    };
  }

  if (
    toCall > 0 &&
    strongThreeCard &&
    position.isLate &&
    drawRound <= 1 &&
    canRaise &&
    canValueRaise &&
    !expensiveCall
  ) {
    return {
      type: "RAISE",
      confidence: 0.66,
      reason: "late-position-strong-3card-pressure-raise",
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
