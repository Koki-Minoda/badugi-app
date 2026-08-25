import { makeViolation } from "./invariantUtils.js";

export function assertCashLifecycleInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.mode && summary.mode !== "cash") return violations;
  if (Number(summary.handsCompleted ?? 0) <= 0) {
    violations.push(makeViolation("CASH_HAND_NOT_COMPLETED", "cash session completed no hands", { ...context, severity: "P0" }));
  }
  if (summary.nextHandStarted === false) {
    violations.push(makeViolation("CASH_NEXT_HAND_FAILED", "cash next hand did not start cleanly", { ...context, severity: "P0" }));
  }
  if (Number(summary.freezes ?? 0) > 0) {
    violations.push(makeViolation("CASH_FREEZE", "cash lifecycle detected freeze", { ...context, severity: "P0" }));
  }
  return violations;
}

