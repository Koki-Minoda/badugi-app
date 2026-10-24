export function resolveEffectiveControllerSnapshot({
  sessionController,
  sessionState,
  candidates = [],
  variantId,
  matchesVariant,
  warn = console.warn,
} = {}) {
  if (typeof matchesVariant !== "function") {
    throw new TypeError("matchesVariant is required");
  }

  try {
    if (
      sessionController &&
      sessionState &&
      typeof sessionController.getUiSnapshot === "function"
    ) {
      const snapshot = sessionController.getUiSnapshot(sessionState);
      if (snapshot?.phase !== "IDLE" && matchesVariant(snapshot, variantId)) {
        return snapshot;
      }
    }
  } catch (error) {
    warn("[UI-ADAPTER] session controller snapshot failed", error);
  }

  return candidates.find((snapshot) => matchesVariant(snapshot, variantId)) ?? null;
}


// Legacy CPU actions still publish partial snapshots in Badugi MTT. Keep the
// session used by controls and subsequent actions on that same completed step.
export function syncTournamentBadugiSession({ controller, state, snapshot, phase, drawRound, handId }) {
  if (!controller?.syncFromExternalState || !state) return state;
  const actor = snapshot.metadata?.actingPlayerIndex ?? snapshot.turn ?? null;
  return controller.syncFromExternalState({
    snapshot: {
      ...snapshot,
      handId: snapshot.handId ?? handId,
      phase: snapshot.phase ?? phase,
      drawRound: snapshot.drawRound ?? drawRound,
      currentBet: snapshot.metadata?.currentBet ?? snapshot.currentBet ?? 0,
      currentActor: actor,
      turn: actor,
      nextTurn: actor,
    },
    context: state.context,
    handIndex: state.handIndex,
  });
}
