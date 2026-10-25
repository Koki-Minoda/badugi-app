const ALLOWED_START_PHASES = new Set([
  "INIT",
  "HAND_RESULT",
  "SHOWDOWN",
  "WAITING_NEXT_HAND",
  "TABLE_FINISHED",
  "TOURNAMENT_END",
  "TOURNAMENT_FINAL",
]);

export function canStartNextHand({
  currentPhase,
  handCount,
  resetPhase,
  tournamentHandSettled = false,
  cashHandSettled = false,
}) {
  return handCount <= 0 ||
    currentPhase === resetPhase ||
    ALLOWED_START_PHASES.has(currentPhase) ||
    tournamentHandSettled ||
    cashHandSettled;
}
