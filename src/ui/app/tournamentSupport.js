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
