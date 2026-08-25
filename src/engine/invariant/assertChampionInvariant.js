import { makeViolation } from "./invariantUtils.js";

export function assertChampionInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.championExpected && summary.championSafe === false) {
    violations.push(makeViolation("CHAMPION_LIFECYCLE_FAILED", "champion path did not terminate tournament safely", { ...context, severity: "P0" }));
  }
  return violations;
}

