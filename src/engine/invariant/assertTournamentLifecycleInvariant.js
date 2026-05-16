import { makeViolation } from "./invariantUtils.js";

export function assertTournamentLifecycleInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.mode && summary.mode !== "tournament") return violations;
  if (Number(summary.tournamentsCompleted ?? 0) <= 0 && summary.requiresCompletion !== false) {
    violations.push(makeViolation("TOURNAMENT_NOT_COMPLETED", "tournament did not complete", { ...context, severity: "P0" }));
  }
  if (Number(summary.freezes ?? 0) > 0) {
    violations.push(makeViolation("TOURNAMENT_FREEZE", "tournament lifecycle detected freeze", { ...context, severity: "P0" }));
  }
  return violations;
}

