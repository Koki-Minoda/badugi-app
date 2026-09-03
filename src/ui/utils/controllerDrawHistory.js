function drawIndexesFromPayload(payload = {}) {
  if (Array.isArray(payload.discardIndexes)) return [...payload.discardIndexes];
  if (Array.isArray(payload.drawIndexes)) return [...payload.drawIndexes];
  return [];
}

/**
 * Resolve the state that belongs to the submitted draw action. Controllers
 * may return a later UI snapshot after the final draw has already settled the
 * hand and cleared busted seats, so that snapshot is not valid action history.
 */
export function resolveControllerDrawHistory({
  outcome,
  seat,
  playerBefore,
  payload,
} = {}) {
  const drawIndexes = drawIndexesFromPayload(payload);
  const settledPlayers = Array.isArray(outcome?.snapshot?.players)
    ? outcome.snapshot.players
    : [];
  const actionPlayers = Array.isArray(outcome?.actionSnapshot?.players)
    ? outcome.actionSnapshot.players
    : settledPlayers;
  const actorAfter = actionPlayers[seat] ?? playerBefore ?? null;
  return {
    actionPlayers,
    actorAfter,
    drawIndexes,
    actionLabel: drawIndexes.length === 0 ? "Pat" : `DRAW(${drawIndexes.length})`,
  };
}
