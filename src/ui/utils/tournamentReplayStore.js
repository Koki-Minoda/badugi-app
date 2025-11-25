let replayState = null;

function sanitizeSeatResult(entry = {}) {
  const start = sanitizeNumber(entry.startingStack);
  const end = sanitizeNumber(entry.stack);
  return {
    playerId: entry.playerId ?? null,
    seatIndex: typeof entry.seatIndex === "number" ? entry.seatIndex : null,
    startStack: start,
    endStack: end,
    bustedThisHand: start > 0 && end === 0,
  };
}

function sanitizeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

export function initTournamentReplay(config) {
  replayState = {
    config: config ? JSON.parse(JSON.stringify(config)) : null,
    startedAt: Date.now(),
    hands: [],
    finalState: null,
  };
}

export function appendTournamentReplayHand(entry) {
  if (!replayState) return;
  replayState.hands.push({
    handId: entry.handId ?? null,
    tableId: entry.tableId ?? null,
    source: entry.source ?? "unknown",
    recordedAt: entry.recordedAt ?? Date.now(),
    meta: entry.meta ?? null,
    seatResults: (entry.seatResults ?? []).map(sanitizeSeatResult),
  });
}

export function finalizeTournamentReplay(state, placements = []) {
  if (!replayState) return;
  replayState.finalState = {
    finishedAt: Date.now(),
    championId: state?.championId ?? null,
    playersRemaining: state?.playersRemaining ?? null,
    placements: Array.isArray(placements)
      ? JSON.parse(JSON.stringify(placements))
      : [],
  };
}

export function getTournamentReplay() {
  return replayState ? JSON.parse(JSON.stringify(replayState)) : null;
}

export function resetTournamentReplay() {
  replayState = null;
}
