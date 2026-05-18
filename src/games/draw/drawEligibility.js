import {
  isSeatActiveForHand,
  isSeatEligibleForBetting,
  isSeatEligibleForDrawing,
} from "../core/turn/actorEligibility.js";

export function canSeatBetAction(player, state = {}) {
  return isSeatEligibleForBetting(player, { ...state, phase: "BET" }, { ignoreActionCompletion: true });
}

export function canSeatDrawAction(player, state = {}) {
  return isSeatEligibleForDrawing(player, { ...state, phase: "DRAW" }, { allowAllInDraw: true });
}

export function canSeatShowdown(player) {
  return isSeatActiveForHand(player);
}
