import { getActor, getPlayers, makeViolation } from "./invariantUtils.js";

export function assertSnapshotConsistencyInvariant(snapshot = {}, context = {}) {
  const violations = [];
  const actor = getActor(snapshot);
  const actorFields = [
    snapshot.currentActor,
    snapshot.actor,
    snapshot.turn,
    snapshot.nextTurn,
    snapshot.metadata?.actingPlayerIndex,
  ].filter((value) => Number.isInteger(value) && value >= 0);
  if (new Set(actorFields).size > 1) {
    violations.push(makeViolation("TURN_SOURCE_DISAGREEMENT", "turn/currentActor/metadata actor fields disagree", { ...context, snapshot }));
  }
  const turnSeats = getPlayers(snapshot).flatMap((player, seat) => (player?.isTurn ? [seat] : []));
  if (turnSeats.length > 1) {
    violations.push(makeViolation("MULTIPLE_TURN_FLAGS", "multiple players have isTurn", { ...context, snapshot }));
  }
  if (turnSeats.length === 1 && actor != null && turnSeats[0] !== actor) {
    violations.push(makeViolation("TURN_FLAG_ACTOR_MISMATCH", "isTurn does not match canonical actor", { ...context, snapshot }));
  }
  return violations;
}

