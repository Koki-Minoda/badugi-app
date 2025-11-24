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
      deck: currentState?.deck ?? null,
      gameId: currentState?.gameId ?? null,
      engineId:
        currentState?.engineId ?? currentState?.gameId ?? null,
    };
  }

  const currentPlayers = Array.isArray(currentState?.players)
    ? currentState.players
    : [];
  const incomingPlayers = Array.isArray(snapshot.players)
    ? snapshot.players
    : currentPlayers;
  const nextPlayers = incomingPlayers.map((incoming, idx) => {
    const fallback = currentPlayers[idx];
    if (!incoming && fallback) return fallback;
    if (!incoming) return incoming;
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
  });
  const nextPots = snapshot.pots ?? currentState?.pots ?? [];
  const nextDeck = snapshot.deck ?? currentState?.deck ?? null;
  const incomingMeta = snapshot.metadata ?? {};
  const nextGameId =
    snapshot.gameId ?? currentState?.gameId ?? currentState?.engineId ?? null;
  const nextEngineId =
    snapshot.engineId ?? currentState?.engineId ?? nextGameId;

  return {
    players: nextPlayers,
    pots: nextPots,
    deck: nextDeck,
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
      actingPlayerIndex:
        typeof incomingMeta.actingPlayerIndex === "number"
          ? incomingMeta.actingPlayerIndex
          : defaultMeta.actingPlayerIndex ?? currentState?.turn ?? 0,
    },
  };
}
