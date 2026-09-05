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
  playersBefore,
  payload,
} = {}) {
  const drawIndexes = drawIndexesFromPayload(payload);
  const settledPlayers = Array.isArray(outcome?.snapshot?.players)
    ? outcome.snapshot.players
    : [];
  const returnedActionPlayers = Array.isArray(outcome?.actionSnapshot?.players)
    ? outcome.actionSnapshot.players
    : settledPlayers;
  // A draw only changes the acting player's cards/draw flags. Some controller
  // transitions settle the hand immediately and can leak that later state into
  // otherwise valid action snapshots. Rebuild the action boundary from the
  // complete pre-action table and replace only the acting seat.
  const actionPlayers = Array.isArray(playersBefore)
    ? playersBefore.map((player, index) =>
        index === seat ? returnedActionPlayers[index] ?? player : player,
      )
    : returnedActionPlayers;
  const actorAfter = actionPlayers[seat] ?? playerBefore ?? null;
  return {
    actionPlayers,
    actorAfter,
    drawIndexes,
    actionLabel: drawIndexes.length === 0 ? "Pat" : `DRAW(${drawIndexes.length})`,
  };
}
