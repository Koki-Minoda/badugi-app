import { STORAGE_KEYS } from "../../storage/keys.js";
import { safeGetItem, safeSetItem } from "../../storage/core.js";
import { isPlainObject } from "../../storage/schemas.js";

export const RIVAL_HISTORY_KEY = STORAGE_KEYS.CAREER_RIVALS;

const DEFAULT_RIVAL_HISTORY = {
  version: 1,
  rivals: {},
};

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
  const parsed = safeGetItem(RIVAL_HISTORY_KEY, null);
  if (!parsed) return { ...DEFAULT_RIVAL_HISTORY, rivals: {} };
  if (!isPlainObject(parsed?.rivals)) return { ...DEFAULT_RIVAL_HISTORY, rivals: {} };
  const rivals = Object.fromEntries(
    Object.entries(parsed?.rivals ?? {}).map(([id, entry]) => [
      id,
      normalizeEntry({ ...entry, opponentId: id }),
    ]),
  );
  return { version: 1, rivals };
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
  safeSetItem(RIVAL_HISTORY_KEY, normalized);
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
