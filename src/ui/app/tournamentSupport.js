import { TOURNAMENT_STRUCTURE } from "../../tournament/tournamentStructure.js";

export function normalizeTournamentBlindLevel(level = {}, index = 0) {
  const levelNumber = level.level ?? level.levelIndex ?? index + 1;
  return {
    level: levelNumber,
    levelIndex: levelNumber,
    sb: level.sb ?? level.smallBlind ?? 0,
    bb: level.bb ?? level.bigBlind ?? 0,
    ante: level.ante ?? 0,
    hands: level.hands ?? level.handsThisLevel ?? 999,
    handsThisLevel: level.handsThisLevel ?? level.hands ?? 999,
  };
}

export function getBlindStructureForTournamentConfig(config) {
  const levels = Array.isArray(config?.levels) ? config.levels : [];
  if (!levels.length) return TOURNAMENT_STRUCTURE;
  return levels.map((level, index) =>
    normalizeTournamentBlindLevel(level, index),
  );
}

export function buildTournamentPlacements(state) {
  if (!state?.players) return [];
  return Object.values(state.players)
    .filter((player) => Number(player?.finishPlace) > 0)
    .sort((a, b) => a.finishPlace - b.finishPlace)
    .map((player) => ({
      id: player.id,
      place: player.finishPlace,
      name: player.name ?? player.id,
      stack: Math.max(0, Number(player.stack) || 0),
      payout: Math.max(0, Number(player.payout) || 0),
    }));
}

export function collectTournamentOpponentProfileIds(state, {
  heroId,
  tableId = null,
  heroTableOnly = false,
} = {}) {
  if (!state?.players || (heroTableOnly && !tableId)) return [];
  return Object.values(state.players)
    .filter((player) => player && player.id !== heroId && player.opponentProfileId)
    .filter((player) => !heroTableOnly || (!player.busted && player.tableId === tableId))
    .map((player) => player.opponentProfileId);
}
