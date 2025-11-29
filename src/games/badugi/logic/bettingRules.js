// src/games/badugi/logic/bettingRules.js
// Fixed-limit Badugi betting uses a "small bet" on the opening street
// and a "big bet" (double the blind) on all subsequent betting streets.

export function isBigBetStreet({ drawRound = 0, betRound = 0 } = {}) {
  const normalizedDraw = Number(drawRound) || 0;
  const normalizedBet = Number(betRound) || 0;
  return normalizedDraw > 0 || normalizedBet > 0;
}

export function getFixedLimitBetSize({
  baseBet = 0,
  drawRound = 0,
  betRound = 0,
} = {}) {
  const normalizedBase = Math.max(1, Number(baseBet) || 0);
  const bigBet = normalizedBase * 2;
  return isBigBetStreet({ drawRound, betRound }) ? bigBet : normalizedBase;
}

