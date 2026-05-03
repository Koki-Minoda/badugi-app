import { isSeatEligibleForDraw } from "../../games/badugi/flow/actionUtils.js";

export function shouldWaitForHeroDrawTurn({
  phase,
  turn,
  heroIndex = 0,
  players = [],
} = {}) {
  if (phase !== "DRAW") return false;
  if (turn !== heroIndex) return false;
  const hero = Array.isArray(players) ? players[heroIndex] : null;
  if (!isSeatEligibleForDraw(hero)) return false;
  if (hero?.allIn || hero?.hasDrawn || hero?.hasActedThisRound) return false;
  return true;
}
