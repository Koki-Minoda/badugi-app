import {
  getCore5MaxDrawRounds,
  isLegalPhaseTransition,
  isTerminalPhase,
  normalizePhaseName,
} from "./phaseMachineGraph.js";

function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function assertLegalPhaseTransition(previous = null, current = {}) {
  const violations = [];
  const prevPhase = normalizePhaseName(previous?.phase);
  const phase = normalizePhaseName(current?.phase);
  const variantId = current?.variantId ?? previous?.variantId ?? null;
  const maxDraws = getCore5MaxDrawRounds(variantId);
  const drawRound = numberOrNull(current?.drawRound);
  const prevDrawRound = numberOrNull(previous?.drawRound);
  const betRound = numberOrNull(current?.betRound);
  const prevBetRound = numberOrNull(previous?.betRound);
  const sameHand = previous?.handId && current?.handId && previous.handId === current.handId;

  if (prevPhase && phase && !isLegalPhaseTransition(prevPhase, phase)) {
    violations.push(
      issue("IMPOSSIBLE_PHASE_TRANSITION", "P0", "phase transition is not in the Core5 legal graph", {
        prevPhase,
        phase,
        handId: current?.handId ?? null,
      }),
    );
  }

  if (sameHand && prevDrawRound !== null && drawRound !== null && drawRound < prevDrawRound) {
    violations.push(
      issue("PHASE_REGRESSION", "P0", "draw round rolled back within the same hand", {
        prevDrawRound,
        drawRound,
        handId: current.handId,
      }),
    );
  }

  if (sameHand && prevBetRound !== null && betRound !== null && betRound < prevBetRound) {
    violations.push(
      issue("PHASE_REGRESSION", "P0", "bet round rolled back within the same hand", {
        prevBetRound,
        betRound,
        handId: current.handId,
      }),
    );
  }

  if (drawRound !== null && drawRound > maxDraws) {
    violations.push(
      issue("ILLEGAL_DRAW_SEQUENCE", "P0", "draw round exceeds variant maximum", {
        variantId,
        drawRound,
        maxDraws,
      }),
    );
  }

  if (isTerminalPhase(phase) && typeof current?.actorSeat === "number") {
    violations.push(
      issue("TERMINAL_WITH_ACTOR", "P0", "terminal phase still has actor", {
        phase,
        actorSeat: current.actorSeat,
      }),
    );
  }

  if (phase === "COLLECT" && typeof current?.actorSeat === "number") {
    violations.push(
      issue("COLLECT_WITH_PENDING_ACTION", "P0", "collect phase still has pending actor", {
        actorSeat: current.actorSeat,
      }),
    );
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    violations,
  };
}

export default assertLegalPhaseTransition;
