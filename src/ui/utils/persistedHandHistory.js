import { getHands, getTournamentHands } from "../../utils/history.js";

function cloneHand(hand) {
  if (!hand) return null;
  try {
    return structuredClone(hand);
  } catch {
    return JSON.parse(JSON.stringify(hand));
  }
}

export function readPersistedHandHistory({ limit = 200 } = {}) {
  const cashHands = getHands({ limit });
  const tournamentHands = getTournamentHands({ limit });
  return [
    ...cashHands.map((hand) => ({ ...hand, historySource: hand.historySource ?? "cash" })),
    ...tournamentHands.map((hand) => ({
      ...hand,
      historySource: hand.historySource ?? "tournament",
    })),
  ];
}

export function mergeHandHistoryLists(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary]
    .filter((hand) => hand?.handId)
    .filter((hand) => {
      if (seen.has(hand.handId)) return false;
      seen.add(hand.handId);
      return true;
    })
    .sort((a, b) => {
      const aTs = a?.endedAt ?? a?.ts ?? a?.startedAt ?? 0;
      const bTs = b?.endedAt ?? b?.ts ?? b?.startedAt ?? 0;
      return bTs - aTs;
    })
    .map(cloneHand);
}

export function findPersistedHandHistoryById(handId, { limit = 2000 } = {}) {
  if (!handId) return null;
  const match = readPersistedHandHistory({ limit }).find((hand) => hand?.handId === handId);
  return cloneHand(match);
}
