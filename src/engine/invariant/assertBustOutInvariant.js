import { makeViolation } from "./invariantUtils.js";

export function assertBustOutInvariant(summary = {}, context = {}) {
  const violations = [];
  if (Number(summary.bustedActorSelected ?? 0) > 0) {
    violations.push(makeViolation("BUSTED_ACTOR_SELECTED", "busted player was selected as actor", { ...context, severity: "P0" }));
  }
  if (summary.heroBustExpected && !summary.heroBustSafe) {
    violations.push(makeViolation("HERO_BUST_LIFECYCLE_FAILED", "hero bust did not produce safe result/menu path", { ...context, severity: "P0" }));
  }
  if (summary.cpuBustExpected && !summary.cpuBustSafe) {
    violations.push(makeViolation("CPU_BUST_LIFECYCLE_FAILED", "CPU bust did not remove player safely", { ...context, severity: "P0" }));
  }
  return violations;
}

