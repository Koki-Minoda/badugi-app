import { findNextDrawActorSeat, findNextActiveSeat } from "./actionUtils.js";
import { findNextBetActorSeat } from "./betRoundUtils.js";

export function findNextActorSeatForPhase({
  phase,
  players = [],
  startIdx = 0,
  currentBet = 0,
} = {}) {
  if (phase === "BET") {
    return findNextBetActorSeat(players, startIdx, currentBet);
  }
  if (phase === "DRAW") {
    return findNextDrawActorSeat(players, startIdx);
  }
  console.warn("[findNextActorSeatForPhase] unexpected phase", phase);
  return null;
}

export function findNextActiveSeatUnified(players = [], startIdx = 0) {
  return findNextActiveSeat(players, startIdx);
}
