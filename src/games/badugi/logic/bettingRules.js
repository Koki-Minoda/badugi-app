// src/games/badugi/logic/bettingRules.js
// Fixed-limit Badugi uses the small bet for the first two betting rounds
// and the big bet after the second draw.

// Fixed-limit draw games use a five-bet cap: opening bet plus four raises.
export const DEFAULT_FIXED_LIMIT_RAISE_CAP = 4;

export function isBigBetStreet({ drawRound = 0, betRound = 0, firstBigBetRound = 2 } = {}) {
  const normalizedDraw = Number(drawRound) || 0;
  const normalizedBet = Number(betRound) || 0;
  return normalizedDraw >= firstBigBetRound || normalizedBet >= firstBigBetRound;
}

export function getFixedLimitBetSize({
  baseBet = 0,
  drawRound = 0,
  betRound = 0,
  firstBigBetRound = 2,
} = {}) {
  const normalizedBase = Math.max(1, Number(baseBet) || 0);
  const bigBet = normalizedBase * 2;
  return isBigBetStreet({ drawRound, betRound, firstBigBetRound }) ? bigBet : normalizedBase;
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
