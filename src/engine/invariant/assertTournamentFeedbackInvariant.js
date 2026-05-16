import { makeViolation } from "./invariantUtils.js";

export function assertTournamentFeedbackInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.feedbackExpected && summary.feedbackSafe === false) {
    violations.push(makeViolation("TOURNAMENT_FEEDBACK_FAILURE", "tournament feedback path is unsafe", { ...context, severity: "P1" }));
  }
  return violations;
}

