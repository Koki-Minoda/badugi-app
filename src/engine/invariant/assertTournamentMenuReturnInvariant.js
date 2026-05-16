import { makeViolation } from "./invariantUtils.js";

export function assertTournamentMenuReturnInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.menuReturnExpected && summary.menuReturnSafe === false) {
    violations.push(makeViolation("TOURNAMENT_MENU_RETURN_FAILED", "tournament result/bust path did not return to menu", { ...context, severity: "P0" }));
  }
  return violations;
}

