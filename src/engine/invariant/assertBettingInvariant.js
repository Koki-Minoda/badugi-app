import { contributionOf, getCurrentBet, getPlayers, makeViolation, stackOf } from "./invariantUtils.js";

export function assertBettingInvariant(snapshot = {}, context = {}) {
  const violations = [];
  const currentBet = getCurrentBet(snapshot);
  if (currentBet < 0) {
    violations.push(makeViolation("NEGATIVE_CURRENT_BET", "currentBet is negative", { ...context, snapshot }));
  }
  getPlayers(snapshot).forEach((player, seat) => {
    if (stackOf(player) < 0) {
      violations.push(makeViolation("NEGATIVE_STACK", `seat ${seat} stack is negative`, { ...context, snapshot }));
    }
    if (contributionOf(player) < 0) {
      violations.push(makeViolation("NEGATIVE_CONTRIBUTION", `seat ${seat} contribution is negative`, { ...context, snapshot }));
    }
  });
  return violations;
}

