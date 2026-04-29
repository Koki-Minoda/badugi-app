// src/games/badugi/logic/bettingRules.js
// Fixed-limit Badugi betting uses a "small bet" on the opening street
// and a "big bet" (double the blind) on all subsequent betting streets.

export const DEFAULT_FIXED_LIMIT_RAISE_CAP = null;

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

export function getFixedLimitRaiseCap(value = null) {
  if (value == null) {
    return DEFAULT_FIXED_LIMIT_RAISE_CAP;
  }
  const normalized = Number(value);
  if (Number.isFinite(normalized) && normalized >= 0) {
    return Math.floor(normalized);
  }
  return DEFAULT_FIXED_LIMIT_RAISE_CAP;
}
