export const RIVAL_HISTORY_KEY = "mgx.career.rivals";

const DEFAULT_RIVAL_HISTORY = {
  version: 1,
  rivals: {},
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeEntry(entry = {}) {
  return {
    opponentId: entry.opponentId ?? null,
    handsPlayed: Math.max(0, Number(entry.handsPlayed) || 0),
    tournamentsMet: Math.max(0, Number(entry.tournamentsMet) || 0),
    heroWins: Math.max(0, Number(entry.heroWins) || 0),
    opponentWins: Math.max(0, Number(entry.opponentWins) || 0),
    lastMetAt: entry.lastMetAt ?? null,
  };
}

export function loadRivalHistory() {
  if (!hasStorage()) return { ...DEFAULT_RIVAL_HISTORY, rivals: {} };
  try {
    const raw = window.localStorage.getItem(RIVAL_HISTORY_KEY);
    if (!raw) return { ...DEFAULT_RIVAL_HISTORY, rivals: {} };
    const parsed = JSON.parse(raw);
    const rivals = Object.fromEntries(
      Object.entries(parsed?.rivals ?? {}).map(([id, entry]) => [
        id,
        normalizeEntry({ ...entry, opponentId: id }),
      ]),
    );
    return { version: 1, rivals };
  } catch (err) {
    console.warn("[RivalHistory] Failed to load:", err);
    return { ...DEFAULT_RIVAL_HISTORY, rivals: {} };
  }
}

export function saveRivalHistory(history) {
  const normalized = {
    version: 1,
    rivals: Object.fromEntries(
      Object.entries(history?.rivals ?? {}).map(([id, entry]) => [
        id,
        normalizeEntry({ ...entry, opponentId: id }),
      ]),
    ),
  };
  if (hasStorage()) {
    window.localStorage.setItem(RIVAL_HISTORY_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function recordRivalTournamentMet(opponentIds = []) {
  const uniqueIds = [...new Set(opponentIds.filter(Boolean))];
  if (!uniqueIds.length) return loadRivalHistory();
  const history = loadRivalHistory();
  const now = Date.now();
  uniqueIds.forEach((opponentId) => {
    const current = normalizeEntry(history.rivals[opponentId]);
    history.rivals[opponentId] = {
      ...current,
      opponentId,
      tournamentsMet: current.tournamentsMet + 1,
      lastMetAt: now,
    };
  });
  return saveRivalHistory(history);
}

export function recordRivalHandPlayed(opponentIds = []) {
  const uniqueIds = [...new Set(opponentIds.filter(Boolean))];
  if (!uniqueIds.length) return loadRivalHistory();
  const history = loadRivalHistory();
  uniqueIds.forEach((opponentId) => {
    const current = normalizeEntry(history.rivals[opponentId]);
    history.rivals[opponentId] = {
      ...current,
      opponentId,
      handsPlayed: current.handsPlayed + 1,
      lastMetAt: Date.now(),
    };
  });
  return saveRivalHistory(history);
}

export function recordRivalTournamentResult(opponentIds = [], heroWon = false) {
  const uniqueIds = [...new Set(opponentIds.filter(Boolean))];
  if (!uniqueIds.length) return loadRivalHistory();
  const history = loadRivalHistory();
  uniqueIds.forEach((opponentId) => {
    const current = normalizeEntry(history.rivals[opponentId]);
    history.rivals[opponentId] = {
      ...current,
      opponentId,
      heroWins: current.heroWins + (heroWon ? 1 : 0),
      opponentWins: current.opponentWins + (heroWon ? 0 : 1),
      lastMetAt: Date.now(),
    };
  });
  return saveRivalHistory(history);
}

export function getRivalHistoryEntry(opponentId) {
  return loadRivalHistory().rivals?.[opponentId] ?? normalizeEntry({ opponentId });
}
