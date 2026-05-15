import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP45_EXPOSURE_RECOVERY_GATE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step45-exposure-recovery-gate.json",
);

export function classifyExposureRecoveryGateSummary({ recovery = {}, safety = {} } = {}) {
  const exactOpportunities = Number(recovery.exactOpportunities ?? 0);
  const exactHits = Number(recovery.exactHits ?? 0);
  const exactHitRate = Number(recovery.exactHitRate ?? 0);
  const illegal = Number(safety.illegal ?? 0);
  const freeze = Number(safety.freeze ?? 0);
  const allIronProPositive = safety.allIronProPositive === true;
  const weakPositive =
    allIronProPositive &&
    (safety.results ?? []).some((row) => Number(row.ironProGap ?? 0) > 0 && Number(row.ironProGap ?? 0) < 0.25);
  let gate = "PASS";
  const reason = [];
  if (exactOpportunities <= 0) {
    gate = "FAIL";
    reason.push("exact-opportunities-zero");
  }
  if (illegal > 0 || freeze > 0) {
    gate = "FAIL";
    if (illegal > 0) reason.push("illegal-action-present");
    if (freeze > 0) reason.push("freeze-present");
  }
  if (safety.status === "FAIL") {
    gate = "FAIL";
    reason.push(...(safety.reason ?? ["regression-safety-failure"]));
  }
  if (gate !== "FAIL" && exactHits <= 0) {
    gate = "WARN";
    reason.push("exact-opportunities-without-hits");
  }
  if (gate !== "FAIL" && !allIronProPositive) {
    gate = "WARN";
    reason.push("iron-pro-not-positive-all-variants");
  }
  if (gate !== "FAIL" && weakPositive) {
    gate = "WARN";
    reason.push("iron-pro-weak-positive");
  }
  if (!reason.length) reason.push("natural-exposure-recovered-with-safety-clear");
  return {
    generatedAt: new Date().toISOString(),
    gate,
    status: gate,
    reason: [...new Set(reason)],
    exactOpportunities,
    exactHits,
    exactHitRate: roundNumber(exactHitRate, 4),
    illegal,
    freeze,
    allIronProPositive,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function classifyExposureRecoveryGate({
  recoveryPath = path.resolve("reports/ai-iron/step45-exact-opportunity-recovery.json"),
  safetyPath = path.resolve("reports/ai-iron/step45-regression-safety.json"),
  outputPath = DEFAULT_STEP45_EXPOSURE_RECOVERY_GATE_OUTPUT_PATH,
  recovery = null,
  safety = null,
} = {}) {
  const report = classifyExposureRecoveryGateSummary({
    recovery: recovery ?? (await readJson(recoveryPath)),
    safety: safety ?? (await readJson(safetyPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await classifyExposureRecoveryGate();
  console.log(JSON.stringify(report, null, 2));
}
