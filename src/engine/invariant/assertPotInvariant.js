import { contributionOf, getPhase, getPlayers, getPotAmount, isTerminal, makeViolation } from "./invariantUtils.js";

export function assertPotInvariant(snapshot = {}, context = {}) {
  const violations = [];
  const pot = getPotAmount(snapshot);
  if (pot < 0) {
    violations.push(makeViolation("NEGATIVE_POT", "pot is negative", { ...context, snapshot }));
  }
  const invested = getPlayers(snapshot).reduce((sum, player) => sum + contributionOf(player), 0);
  const activePhase = ["BET", "DRAW"].includes(getPhase(snapshot));
  if (!isTerminal(snapshot) && activePhase && invested > 0 && pot + invested <= 0) {
    violations.push(makeViolation("ACTIVE_HAND_TOTAL_POT_ZERO", "active hand has invested chips but total pot is zero", { ...context, snapshot }));
  }
  return violations;
}

