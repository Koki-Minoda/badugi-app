import { makeViolation } from "./invariantUtils.js";

export function assertPayoutInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.payoutsExpected && summary.payoutSafe === false) {
    violations.push(makeViolation("PAYOUT_FAILURE", "payout assignment failed", { ...context, severity: "P0" }));
  }
  return violations;
}

