import { getActor, getPlayers, isTerminal, makeViolation } from "./invariantUtils.js";

export function assertTerminalInvariant(snapshot = {}, context = {}) {
  const violations = [];
  if (!isTerminal(snapshot)) return violations;
  if (getActor(snapshot) != null) {
    violations.push(makeViolation("TERMINAL_ACTOR_NOT_CLEARED", "terminal snapshot retained an actor", { ...context, snapshot }));
  }
  const turnSeats = getPlayers(snapshot).flatMap((player, seat) => (player?.isTurn ? [seat] : []));
  if (turnSeats.length > 0) {
    violations.push(makeViolation("TERMINAL_TURN_FLAG", "terminal snapshot retained isTurn flag", { ...context, snapshot }));
  }
  return violations;
}

