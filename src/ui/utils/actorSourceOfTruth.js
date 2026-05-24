const ACTION_PHASES = new Set(["BET", "DRAW"]);

export function resolveActorFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (typeof snapshot.currentActor === "number") return snapshot.currentActor;
  if (typeof snapshot.actingPlayerIndex === "number") return snapshot.actingPlayerIndex;
  if (typeof snapshot.turnSeat === "number") return snapshot.turnSeat;
  if (typeof snapshot.turn === "number") return snapshot.turn;
  if (typeof snapshot.nextTurn === "number") return snapshot.nextTurn;
  if (typeof snapshot.metadata?.actingPlayerIndex === "number") {
    return snapshot.metadata.actingPlayerIndex;
  }
  return null;
}

export function resolveSessionPreferredActor({
  sessionController,
  sessionState,
  gameController,
  preferSession = false,
  warn,
} = {}) {
  if (preferSession) {
    try {
      if (
        sessionController &&
        sessionState &&
        typeof sessionController.getUiSnapshot === "function"
      ) {
        const sessionActor = resolveActorFromSnapshot(
          sessionController.getUiSnapshot(sessionState),
        );
        if (typeof sessionActor === "number") return sessionActor;
      }
    } catch (err) {
      warn?.("[CTRL][TURN] unable to read session controller turn", err);
    }

    const stateActor = resolveActorFromSnapshot(sessionState);
    if (typeof stateActor === "number") return stateActor;
  }

  try {
    if (gameController && typeof gameController.getSnapshot === "function") {
      return resolveActorFromSnapshot(gameController.getSnapshot());
    }
  } catch (err) {
    warn?.("[CTRL][TURN] unable to read controller turn", err);
  }

  return null;
}

export function isSeatActionEligibleForPhase(players, seat, phase) {
  if (!ACTION_PHASES.has(String(phase ?? "").toUpperCase())) return false;
  if (!Array.isArray(players)) return false;
  if (typeof seat !== "number" || Number.isNaN(seat) || seat < 0 || seat >= players.length) {
    return false;
  }
  const player = players[seat];
  if (!player) return false;
  if (player.folded || player.hasFolded || player.seatOut || player.isBusted || player.busted) {
    return false;
  }
  const normalizedPhase = String(phase).toUpperCase();
  if (normalizedPhase === "DRAW") {
    // TDA-style rule: all-in players and stack=0 players may still take
    // pat/draw decisions.  Folded/busted/seatOut are already excluded above.
    // Only skip a seat that has already drawn this round.
    return !player.hasDrawn;
  }
  // BET: all-in and stack=0 seats cannot take betting actions.
  const stack = Math.max(0, Number(player.stack) || 0);
  if (player.allIn || stack <= 0) return false;
  return true;
}

export function resolveCanonicalActionSeat({
  phase,
  controllerTurn,
  legacyTurn,
  players,
} = {}) {
  if (isSeatActionEligibleForPhase(players, controllerTurn, phase)) {
    return controllerTurn;
  }
  if (isSeatActionEligibleForPhase(players, legacyTurn, phase)) {
    return legacyTurn;
  }
  return null;
}

export function shouldSyncLegacyTurnToController({
  phase,
  controllerTurn,
  legacyTurn,
  players,
} = {}) {
  return (
    isSeatActionEligibleForPhase(players, controllerTurn, phase) &&
    controllerTurn !== legacyTurn
  );
}
