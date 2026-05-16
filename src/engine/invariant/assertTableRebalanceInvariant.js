import { makeViolation } from "./invariantUtils.js";

export function assertTableRebalanceInvariant(summary = {}, context = {}) {
  const violations = [];
  if (summary.rebalanceEnabled && summary.rebalanceSafe === false) {
    violations.push(makeViolation("TABLE_REBALANCE_FAILED", "rebalance duplicated/missed/reseated invalid players", { ...context, severity: "P0" }));
  }
  return violations;
}

