import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP45_REGRESSION_SAFETY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step45-regression-safety.json",
);

export function summarizeStep45RegressionSafety({ arena = {}, determinism = {} } = {}) {
  const rows = (arena.results ?? []).map((result) => ({
    variant: result.variant,
    ironEv: roundNumber(result.ironEv, 4),
    proEv: roundNumber(result.proEv, 4),
    standardEv: roundNumber(result.standardEv, 4),
    ironProGap: roundNumber(result.ironProGap, 4),
    datasetHitRate: roundNumber(result.datasetHitRate, 6),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
  }));
  const illegal = rows.reduce((sum, row) => sum + row.illegal, 0);
  const freeze = rows.reduce((sum, row) => sum + row.freeze, 0);
  const worstIronProGap = rows.reduce((worst, row) => Math.min(worst, row.ironProGap), Number.POSITIVE_INFINITY);
  const deterministic = determinism.deterministic === true && Number(determinism.mismatchCount ?? 0) === 0;
  const failures = [];
  if (illegal > 0) failures.push("illegal-action-present");
  if (freeze > 0) failures.push("freeze-present");
  if (!deterministic) failures.push("determinism-failure");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) failures.push("catastrophic-iron-pro-regression");
  return {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "FAIL" : "PASS",
    verdict: failures.length ? "FAIL" : "SAFE",
    reason: failures.length ? failures : ["all-regression-safety-gates-clear"],
    illegal,
    freeze,
    deterministic,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    invalidReplayCount: Number(determinism.invalidReplayCount ?? 0),
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
    allIronProPositive: rows.length > 0 && rows.every((row) => row.ironProGap > 0),
    results: rows,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function auditStep45RegressionSafety({
  arenaPath = path.resolve("reports/ai-iron/iron-step45-natural-mixed-arena.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-iron-step45.json"),
  outputPath = DEFAULT_STEP45_REGRESSION_SAFETY_OUTPUT_PATH,
  arena = null,
  determinism = null,
} = {}) {
  const report = summarizeStep45RegressionSafety({
    arena: arena ?? (await readJson(arenaPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep45RegressionSafety();
  console.log(JSON.stringify(report, null, 2));
}
