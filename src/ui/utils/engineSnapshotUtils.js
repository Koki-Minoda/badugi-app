export function mergeEngineSnapshot(currentState, snapshot) {
  const defaultMeta = currentState?.metadata ?? {};
  if (!snapshot) {
    return {
      players: currentState?.players ?? [],
      pots: currentState?.pots ?? [],
      metadata: {
        currentBet: defaultMeta.currentBet ?? 0,
        betHead: defaultMeta.betHead ?? 0,
        lastAggressor: defaultMeta.lastAggressor ?? null,
        actingPlayerIndex: defaultMeta.actingPlayerIndex ?? 0,
      },
      deck: Array.isArray(currentState?.deck) ? currentState.deck : [],
      discard: Array.isArray(currentState?.discard) ? currentState.discard : [],
      burn: Array.isArray(currentState?.burn) ? currentState.burn : [],
      gameId: currentState?.gameId ?? null,
      engineId:
        currentState?.engineId ?? currentState?.gameId ?? null,
    };
  }

  console.log("[MERGE][DECK_STATUS]", {
    incomingDeck: Array.isArray(snapshot?.deck) ? snapshot.deck.length : null,
    currentDeck: Array.isArray(currentState?.deck) ? currentState.deck.length : null,
  });

  const currentPlayers = Array.isArray(currentState?.players)
    ? currentState.players
    : [];
  const hasIncomingPlayers = Array.isArray(snapshot.players);
  const nextPlayers = hasIncomingPlayers
    ? snapshot.players.map((incoming, idx) => {
        if (!incoming) {
          return currentPlayers[idx] ?? incoming;
        }
        const prior = currentPlayers[idx];
        if (prior && (prior.folded || prior.hasFolded || prior.seatOut)) {
          return {
            ...incoming,
            folded: true,
            hasFolded: true,
            seatOut: prior.seatOut || incoming.seatOut,
          };
        }
        return incoming;
      })
    : currentPlayers;
  const nextPots = snapshot.pots ?? currentState?.pots ?? [];
  const nextDeck = Array.isArray(snapshot.deck) ? [...snapshot.deck] : [];
  const nextDiscard = Array.isArray(snapshot.discard) ? [...snapshot.discard] : [];
  const nextBurn = Array.isArray(snapshot.burn) ? [...snapshot.burn] : [];
  const incomingMeta = snapshot.metadata ?? {};
  const snapshotTurn =
    typeof snapshot?.nextTurn === "number"
      ? snapshot.nextTurn
      : typeof snapshot?.turn === "number"
      ? snapshot.turn
      : undefined;
  const nextGameId =
    snapshot.gameId ?? currentState?.gameId ?? currentState?.engineId ?? null;
  const nextEngineId =
    snapshot.engineId ?? currentState?.engineId ?? nextGameId;

  console.log("[MERGE][PLAYER_DEBUG]", {
    idx: 5,
    incoming: hasIncomingPlayers ? snapshot.players?.[5] : undefined,
    merged: nextPlayers?.[5],
  });

  const shouldReuseSnapshotPlayers =
    hasIncomingPlayers &&
    nextPlayers.length === snapshot.players.length &&
    nextPlayers.every((player, idx) => player === snapshot.players[idx]);

  const actingPlayerIndex =
    typeof snapshotTurn === "number"
      ? snapshotTurn
      : null;

  console.log("[MERGE][TURN_DEBUG]", {
    snapshotNextTurn: snapshot.nextTurn,
    snapshotTurn,
    metadataActing: actingPlayerIndex,
  });

  return {
    players: shouldReuseSnapshotPlayers ? snapshot.players : nextPlayers,
    pots: nextPots,
    deck: nextDeck,
    discard: nextDiscard,
    burn: nextBurn,
    gameId: nextGameId,
    engineId: nextEngineId,
    metadata: {
      currentBet:
        typeof incomingMeta.currentBet === "number"
          ? incomingMeta.currentBet
          : defaultMeta.currentBet ?? currentState?.currentBet ?? 0,
      betHead:
        typeof incomingMeta.betHead === "number"
          ? incomingMeta.betHead
          : defaultMeta.betHead ?? currentState?.betHead ?? 0,
      lastAggressor:
        typeof incomingMeta.lastAggressor === "number"
          ? incomingMeta.lastAggressor
          : defaultMeta.lastAggressor ?? currentState?.lastAggressor ?? null,
      actingPlayerIndex,
    },
  };
}
