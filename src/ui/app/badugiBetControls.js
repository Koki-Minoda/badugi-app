import { maxBetThisRound } from "../../games/badugi/flow/actionUtils.js";

// Badugi's street contributions are the betting source of truth. A cached
// currentBet can still describe the previous street during a draw transition.
export function resolveBadugiBetControls(snapshot, heroSeat = 0) {
  if (!Array.isArray(snapshot?.players)) return null;
  const hero = snapshot.players[heroSeat];
  if (!hero) return null;
  return {
    currentBet: maxBetThisRound(snapshot.players),
    heroBet: Math.max(0, Number(hero.betThisRound) || 0),
    heroStack: Math.max(0, Number(hero.stack) || 0),
  };
}
