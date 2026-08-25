import { assertLegalPhaseTransition } from "../../games/_core/assertLegalPhaseTransition.js";

function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function simplify(row = {}) {
  return {
    variantId: row.variantId,
    handId: row.handId,
    phase: row.phase,
    drawRound: row.drawRound,
    betRound: row.betRound,
    actorSeat: row.controller?.actorSeat ?? null,
  };
}

export function assertImpossiblePhaseTransition(row = {}, previousRows = []) {
  const previous = [...(previousRows ?? [])]
    .reverse()
    .find((entry) => entry?.handId === row?.handId && entry?.variantId === row?.variantId);
  const legal = assertLegalPhaseTransition(previous ? simplify(previous) : null, simplify(row));
  const violations = [...legal.violations];

  const actorSources = [
    row.controller?.actorSeat,
    row.controller?.nextTurn,
    row.mergeSource?.mergedActor,
  ].filter((value) => typeof value === "number");
  if (new Set(actorSources).size > 1) {
    violations.push(
      issue("MULTI_ACTOR_STATE", "P0", "multiple actor sources disagree", {
        actorSeat: row.controller?.actorSeat ?? null,
        nextTurn: row.controller?.nextTurn ?? null,
        mergedActor: row.mergeSource?.mergedActor ?? null,
      }),
    );
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    violations,
  };
}

export default assertImpossiblePhaseTransition;
