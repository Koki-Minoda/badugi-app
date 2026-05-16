import { makeViolation } from "./invariantUtils.js";

export function assertCashOutInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.cashOutAttempted && !summary.cashOutReturnedToMenu) {
    violations.push(makeViolation("CASH_OUT_MENU_RETURN_FAILED", "cash out did not return to menu", { ...context, severity: "P0" }));
  }
  if (summary.reenterAttempted && !summary.reenterClean) {
    violations.push(makeViolation("CASH_REENTER_FAILED", "cash table re-enter did not start/resume safely", { ...context, severity: "P0" }));
  }
  return violations;
}

