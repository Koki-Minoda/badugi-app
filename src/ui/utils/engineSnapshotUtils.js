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
    };
  }

  const nextPlayers = snapshot.players ?? currentState?.players ?? [];
  const nextPots = snapshot.pots ?? currentState?.pots ?? [];
  const nextDeck = snapshot.deck ?? currentState?.deck ?? null;
  const incomingMeta = snapshot.metadata ?? {};

  return {
    players: nextPlayers,
    pots: nextPots,
    deck: nextDeck,
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
