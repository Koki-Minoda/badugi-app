import {
  eligibleBetSeats,
  getActor,
  getPhase,
  getPlayers,
  isAllIn,
  isFolded,
  isSeatOut,
  isTerminal,
  makeViolation,
} from "./invariantUtils.js";

export function assertActorInvariant(snapshot = {}, context = {}) {
  const violations = [];
  const phase = getPhase(snapshot);
  const players = getPlayers(snapshot);
  const actor = getActor(snapshot);

  if (isTerminal(snapshot)) {
    if (actor != null) {
      violations.push(makeViolation("TERMINAL_ACTOR_NOT_CLEARED", "terminal state still has an actor", { ...context, snapshot }));
    }
    return violations;
  }

  if (actor == null) {
    if (phase === "BET" && eligibleBetSeats(snapshot).length > 0) {
      violations.push(makeViolation("MISSING_ACTOR", "eligible betting player exists but no actor is set", { ...context, snapshot }));
    }
    return violations;
  }

  const player = players[actor];
  if (!player) {
    violations.push(makeViolation("ACTOR_MISSING", "actor seat does not exist", { ...context, snapshot }));
    return violations;
  }
  if (isFolded(player)) {
    violations.push(makeViolation("FOLDED_ACTOR", "folded player received action", { ...context, snapshot }));
  }
  if (isSeatOut(player)) {
    violations.push(makeViolation("BUSTED_ACTOR", "seat-out/busted player received action", { ...context, snapshot }));
  }
  if (phase === "BET" && isAllIn(player)) {
    violations.push(makeViolation("ALL_IN_BET_ACTOR", "all-in player received betting action", { ...context, snapshot }));
  }
  return violations;
}

