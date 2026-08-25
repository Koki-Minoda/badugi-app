import { drawRoundOf, getPhase, getPlayers, isFolded, isSeatOut, makeViolation } from "./invariantUtils.js";

export function assertDrawInvariant(snapshot = {}, context = {}) {
  const violations = [];
  const drawRound = drawRoundOf(snapshot);
  const maxDraws = Number(context.maxDraws ?? snapshot.maxDraws ?? snapshot.metadata?.maxDraws ?? Infinity);
  if (Number.isFinite(maxDraws) && drawRound > maxDraws) {
    violations.push(makeViolation("DRAW_ROUND_EXCEEDED", "draw round exceeds variant max", { ...context, snapshot }));
  }
  const handSize = Number(context.handSize ?? snapshot.handSize ?? snapshot.metadata?.handSize ?? 0);
  if (handSize > 0 && ["BET", "DRAW"].includes(getPhase(snapshot))) {
    getPlayers(snapshot).forEach((player, seat) => {
      const cards = player?.hand ?? player?.holeCards ?? player?.cards;
      if (Array.isArray(cards) && cards.length > 0 && !isFolded(player) && !isSeatOut(player) && cards.length !== handSize) {
        violations.push(makeViolation("HAND_SIZE_MISMATCH", `seat ${seat} hand size changed`, { ...context, snapshot }));
      }
    });
  }
  return violations;
}

