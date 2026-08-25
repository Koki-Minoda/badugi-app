import { useCallback, useState } from "react";

const DEFAULT_OVERLAYS = {
  handResult: { visible: false, summary: null },
  showNextButton: false,
};

const DEFAULT_RAISE_STATS = {
  raiseCountThisRound: 0,
  raisePerRound: [0, 0, 0, 0],
  raisePerSeatRound: [],
};

function clonePlayers(players = []) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => (player ? { ...player } : player));
}

function clonePots(pots = []) {
  if (!Array.isArray(pots)) return [];
  return pots.map((pot) => (pot ? { ...pot } : pot));
}

function normalizeSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") return {};
  const metadata = snapshot.metadata ?? {};
  const resolvedNextTurn =
    typeof snapshot.nextTurn === "number"
      ? snapshot.nextTurn
      : typeof snapshot.turn === "number"
      ? snapshot.turn
      : typeof snapshot.currentActor === "number"
      ? snapshot.currentActor
      : typeof metadata.actingPlayerIndex === "number"
      ? metadata.actingPlayerIndex
      : null;

  return {
    handId: snapshot.handId ?? null,
    dealerSeat:
      snapshot.dealerSeat ??
      snapshot.dealerIdx ??
      snapshot.dealerIndex ??
      metadata.dealerSeat ??
      null,
    heroSeat: snapshot.heroSeat ?? null,
    players: clonePlayers(snapshot.players),
    pots: clonePots(snapshot.pots),
    phase: snapshot.phase ?? metadata.phase ?? null,
    drawRound:
      snapshot.drawRound ??
      snapshot.drawRoundIndex ??
      metadata.drawRound ??
      null,
    betRoundIndex:
      snapshot.betRoundIndex ??
      snapshot.drawRound ??
      snapshot.drawRoundIndex ??
      metadata.betRoundIndex ??
      null,
    turnSeat: resolvedNextTurn,
    betHead:
      snapshot.betHead ??
      metadata.betHead ??
      snapshot.metadata?.betHead ??
      null,
    lastAggressor:
      snapshot.lastAggressor ??
      metadata.lastAggressor ??
      snapshot.metadata?.lastAggressor ??
      null,
    currentBet:
      snapshot.currentBet ??
      metadata.currentBet ??
      snapshot.metadata?.currentBet ??
      0,
    raiseStats: snapshot.raiseStats ?? null,
    heroDrawSelection:
      Array.isArray(snapshot.heroDrawSelection) ?
        [...snapshot.heroDrawSelection] :
        null,
    actionLog: Array.isArray(snapshot.actionLog)
      ? [...snapshot.actionLog]
      : null,
    tableMeta: snapshot.tableMeta ?? null,
    debug: snapshot.debug ?? null,
  };
}

function mapSnapshotToSession(prev = null, snapshot = {}) {
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized.players.length && prev?.players) {
    normalized.players = clonePlayers(prev.players);
  }
  if (!normalized.pots.length && prev?.pots) {
    normalized.pots = clonePots(prev.pots);
  }

  const baseRaiseStats =
    normalized.raiseStats ?? prev?.raiseStats ?? DEFAULT_RAISE_STATS;
  const resolvedRaiseStats = {
    raiseCountThisRound: baseRaiseStats.raiseCountThisRound ?? 0,
    raisePerRound: Array.isArray(baseRaiseStats.raisePerRound)
      ? [...baseRaiseStats.raisePerRound]
      : [],
    raisePerSeatRound: Array.isArray(baseRaiseStats.raisePerSeatRound)
      ? baseRaiseStats.raisePerSeatRound.map((row) =>
          Array.isArray(row) ? [...row] : [],
        )
      : [],
  };

  return {
    handId: normalized.handId ?? prev?.handId ?? `${Date.now()}`,
    dealerSeat: normalized.dealerSeat ?? prev?.dealerSeat ?? 0,
    heroSeat: normalized.heroSeat ?? prev?.heroSeat ?? 0,
    players: normalized.players,
    pots: normalized.pots,
    phase: normalized.phase ?? prev?.phase ?? "BET",
    drawRound: normalized.drawRound ?? prev?.drawRound ?? 0,
    betRoundIndex: normalized.betRoundIndex ?? prev?.betRoundIndex ?? 0,
    turnSeat: normalized.turnSeat ?? prev?.turnSeat ?? 0,
    betHead: normalized.betHead ?? prev?.betHead ?? null,
    lastAggressor: normalized.lastAggressor ?? prev?.lastAggressor ?? null,
    currentBet: normalized.currentBet ?? prev?.currentBet ?? 0,
    raiseStats: resolvedRaiseStats,
    heroDrawSelection:
      normalized.heroDrawSelection ?? prev?.heroDrawSelection ?? [],
    actionLog: normalized.actionLog ?? prev?.actionLog ?? [],
    overlays: prev?.overlays ?? { ...DEFAULT_OVERLAYS },
    tableMeta: normalized.tableMeta ?? prev?.tableMeta ?? {},
    debug: normalized.debug ?? prev?.debug ?? {},
  };
}

/**
 * @typedef {Object} GameSession
 * @property {string} handId
 * @property {number} dealerSeat
 * @property {number} heroSeat
 * @property {Array<object>} players
 * @property {Array<object>} pots
 * @property {"BET"|"DRAW"|"SHOWDOWN"|string} phase
 * @property {number} drawRound
 * @property {number} betRoundIndex
 * @property {number} turnSeat
 * @property {number|null} betHead
 * @property {number|null} lastAggressor
 * @property {number} currentBet
 * @property {{
 *   raiseCountThisRound: number;
 *   raisePerRound: number[];
 *   raisePerSeatRound: number[][];
 * }} raiseStats
 * @property {number[]} heroDrawSelection
 * @property {Array<object>} actionLog
 * @property {{
 *   handResult: { visible: boolean; summary: any | null };
 *   showNextButton: boolean;
 * }} overlays
 * @property {object} tableMeta
 * @property {{ deck?: string[]; engineState?: object }} debug
 */

/**
 * Minimal single-table session container.
 * During Step 2 it only mirrors existing App-level state so we can
 * gradually migrate callers without breaking behavior.
 */
export function useGameSessionState() {
  const [session, setSession] = useState(null); // /** @type {GameSession|null} */

  // NOTE: Legacy/fallback path. Single-table Badugi uses resetForNewHandFromSnapshot
  // via controller snapshots. This is kept for tournaments / sync failures.
  const resetForNewHand = useCallback((partial = {}) => {
    setSession((prev) => {
      const nextHandId = partial.handId ?? prev?.handId ?? `${Date.now()}`;
      return {
        handId: nextHandId,
        dealerSeat: partial.dealerSeat ?? prev?.dealerSeat ?? 0,
        heroSeat: partial.heroSeat ?? prev?.heroSeat ?? 0,
        players: Array.isArray(partial.players) ? partial.players : prev?.players ?? [],
        pots: Array.isArray(partial.pots) ? partial.pots : prev?.pots ?? [],
        phase: partial.phase ?? prev?.phase ?? "BET",
        drawRound: partial.drawRound ?? prev?.drawRound ?? 0,
        betRoundIndex: partial.betRoundIndex ?? prev?.betRoundIndex ?? 0,
        turnSeat: partial.turnSeat ?? prev?.turnSeat ?? 0,
        betHead: typeof partial.betHead === "number" ? partial.betHead : prev?.betHead ?? null,
        lastAggressor:
          typeof partial.lastAggressor === "number"
            ? partial.lastAggressor
            : prev?.lastAggressor ?? null,
        currentBet: partial.currentBet ?? prev?.currentBet ?? 0,
        raiseStats: partial.raiseStats ?? prev?.raiseStats ?? {
          raiseCountThisRound: partial.raiseCountThisRound ?? 0,
          raisePerRound: partial.raisePerRound ?? [],
          raisePerSeatRound: partial.raisePerSeatRound ?? [],
        },
        heroDrawSelection: Array.isArray(partial.heroDrawSelection)
          ? partial.heroDrawSelection
          : prev?.heroDrawSelection ?? [],
        actionLog: Array.isArray(partial.actionLog) ? partial.actionLog : prev?.actionLog ?? [],
        overlays: partial.overlays ?? prev?.overlays ?? {
          handResult: { visible: false, summary: null },
          showNextButton: false,
        },
        tableMeta: partial.tableMeta ?? prev?.tableMeta ?? {},
        debug: partial.debug ?? prev?.debug ?? {},
      };
    });
  }, []);

  const resetForNewHandFromSnapshot = useCallback((snapshot = {}) => {
    setSession((prev) => {
      const mapped = mapSnapshotToSession(prev, snapshot);
      const normalizedPhase = snapshot?.phase ?? snapshot?.metadata?.phase ?? "BET";
      const normalizedDrawRound =
        snapshot?.drawRound ?? snapshot?.drawRoundIndex ?? snapshot?.metadata?.drawRound ?? 0;
      const normalizedBetRound =
        snapshot?.betRoundIndex ?? snapshot?.drawRound ?? snapshot?.drawRoundIndex ?? 0;
      return {
        ...mapped,
        phase: normalizedPhase,
        drawRound: Number.isFinite(normalizedDrawRound) ? normalizedDrawRound : 0,
        betRoundIndex: Number.isFinite(normalizedBetRound) ? normalizedBetRound : 0,
        overlays: { ...DEFAULT_OVERLAYS },
      };
    });
  }, []);

  // NOTE: Legacy/fallback path. Single-table controller flows use
  // updateAfterActionFromSnapshot instead.
  const updateAfterAction = useCallback((partial = {}) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...partial,
        players: Array.isArray(partial.players) ? partial.players : prev.players,
        pots: Array.isArray(partial.pots) ? partial.pots : prev.pots,
        heroDrawSelection: Array.isArray(partial.heroDrawSelection)
          ? partial.heroDrawSelection
          : prev.heroDrawSelection,
        actionLog: Array.isArray(partial.actionLog) ? partial.actionLog : prev.actionLog,
        raiseStats: partial.raiseStats
          ? {
              ...prev.raiseStats,
              ...partial.raiseStats,
            }
          : prev.raiseStats,
        overlays: partial.overlays
          ? {
              ...prev.overlays,
              ...partial.overlays,
              handResult: {
                ...prev.overlays.handResult,
                ...partial.overlays.handResult,
              },
            }
          : prev.overlays,
      };
    });
  }, []);

  const updateAfterActionFromSnapshot = useCallback((snapshot = {}) => {
    setSession((prev) => {
      const mapped = mapSnapshotToSession(prev, snapshot);
      return {
        ...mapped,
        overlays: prev?.overlays ?? { ...DEFAULT_OVERLAYS },
      };
    });
  }, []);

  const updateShowdown = useCallback((partial = {}) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phase: partial.phase ?? prev.phase,
        players: Array.isArray(partial.players) ? partial.players : prev.players,
        pots: Array.isArray(partial.pots) ? partial.pots : prev.pots,
        overlays: {
          ...prev.overlays,
          handResult: {
            visible:
              typeof partial.handResultVisible === "boolean"
                ? partial.handResultVisible
                : prev.overlays.handResult.visible,
            summary:
              partial.handResultSummary !== undefined
                ? partial.handResultSummary
                : prev.overlays.handResult.summary,
          },
          showNextButton:
            typeof partial.showNextButton === "boolean"
              ? partial.showNextButton
              : prev.overlays.showNextButton,
        },
      };
    });
  }, []);

  return {
    session,
    setSession,
    resetForNewHand,
    resetForNewHandFromSnapshot,
    updateAfterAction,
    updateAfterActionFromSnapshot,
    updateShowdown,
  };
}

export default useGameSessionState;
