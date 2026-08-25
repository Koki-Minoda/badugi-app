import { assertNoCrossVariantStateLeak } from "./assertNoCrossVariantStateLeak.js";

export function assertNoStaleControllerReuse(audit = {}) {
  const result = assertNoCrossVariantStateLeak(audit);
  const staleKeys = [];
  const previous = audit.previous ?? {};
  const next = audit.next ?? audit;

  for (const key of ["phase", "drawRound", "betRound", "currentBet", "actingPlayerIndex", "nextTurn"]) {
    if (
      previous[key] != null &&
      next[key] != null &&
      previous[key] === next[key] &&
      audit.previousVariant &&
      audit.nextVariant &&
      audit.previousVariant !== audit.nextVariant
    ) {
      staleKeys.push(key);
    }
  }

  const violations = [...result.violations];
  if (staleKeys.length > 0 && result.status === "FAIL") {
    violations.push({
      type: "CROSS_VARIANT_STALE_KEYS",
      severity: "P1",
      message: "state keys match across a variant boundary with an existing hard mismatch",
      staleKeys,
    });
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    staleKeys,
    violations,
  };
}

