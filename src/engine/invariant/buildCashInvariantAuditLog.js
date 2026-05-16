import { assertCashLifecycleInvariant } from "./assertCashLifecycleInvariant.js";
import { assertCashOutInvariant } from "./assertCashOutInvariant.js";
import { assertCashSessionInvariant } from "./assertCashSessionInvariant.js";
import { assertCashFeedbackInvariant } from "./assertCashFeedbackInvariant.js";

export function buildCashInvariantAuditLog(rows = []) {
  return rows.map((row) => {
    const context = { variantId: row.variant, mode: "cash" };
    const violations = [
      ...assertCashLifecycleInvariant(row, context),
      ...assertCashOutInvariant(row, context),
      ...assertCashSessionInvariant(row, context),
      ...assertCashFeedbackInvariant(row, context),
    ];
    return { ...row, mode: "cash", invariantViolations: violations.length, violations };
  });
}

