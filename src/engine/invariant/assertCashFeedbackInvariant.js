import { makeViolation } from "./invariantUtils.js";

export function assertCashFeedbackInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.feedbackEnabled === false) return violations;
  if (summary.feedbackEnabled && summary.feedbackSafe === false) {
    violations.push(makeViolation("CASH_FEEDBACK_FAILURE", "cash feedback path is unsafe", { ...context, severity: "P1" }));
  }
  return violations;
}

