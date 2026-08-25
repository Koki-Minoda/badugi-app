import { makeViolation } from "./invariantUtils.js";

export function assertCashSessionInvariant(summary = {}, context = {}) {
  const violations = [];
  if (Number(summary.actorMismatches ?? 0) > 0) {
    violations.push(makeViolation("CASH_ACTOR_MISMATCH", "cash session has actor mismatch", { ...context, severity: "P0" }));
  }
  if (Number(summary.potFailures ?? 0) > 0) {
    violations.push(makeViolation("CASH_POT_FAILURE", "cash session has pot failure", { ...context, severity: "P0" }));
  }
  if (Number(summary.terminalFailures ?? 0) > 0) {
    violations.push(makeViolation("CASH_TERMINAL_FAILURE", "cash terminal transition failed", { ...context, severity: "P0" }));
  }
  return violations;
}

