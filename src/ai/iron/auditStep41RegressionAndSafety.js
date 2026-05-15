import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP41_ARENA_PATH = path.resolve("reports/ai-iron/iron-step41-targeted-smoke-arena.json");
export const DEFAULT_STEP41_REGRESSION_SAFETY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step41-regression-safety.json",
);

function sumMetric(arena = {}, metric = "") {
  return (arena.results ?? []).reduce((sum, result) => sum + Number(result?.[metric] ?? 0), 0);
}

export function summarizeStep41RegressionAndSafety({ arena = {}, deterministic = true } = {}) {
  const rows = (arena.results ?? []).map((result) => ({
    variant: result.variant,
    ironEv: roundNumber(result.ironEv, 4),
    proEv: roundNumber(result.proEv, 4),
    standardEv: roundNumber(result.standardEv, 4),
    ironProGap: roundNumber(result.ironProGap, 4),
    datasetHitRate: roundNumber(result.datasetHitRate, 6),
    proFallbackRate: roundNumber(result.proFallbackRate ?? result.fallback, 6),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
  }));
  const illegal = sumMetric(arena, "illegal");
  const freeze = sumMetric(arena, "freeze");
  const worstIronProGap = rows.reduce((worst, row) => Math.min(worst, row.ironProGap), Number.POSITIVE_INFINITY);
  const failures = [];
  if (illegal > 0) failures.push("illegal-action-present");
  if (freeze > 0) failures.push("freeze-present");
  if (!deterministic) failures.push("determinism-break");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) failures.push("catastrophic-iron-pro-regression");
  return {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "FAIL" : "PASS",
    verdict: failures.length ? "FAIL" : "SAFE",
    reason: failures.length ? failures : ["no-catastrophic-regression", "all-safety-gates-clear"],
    illegal,
    freeze,
    deterministic: Boolean(deterministic),
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
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

export async function auditStep41RegressionAndSafety({
  arenaPath = DEFAULT_STEP41_ARENA_PATH,
  outputPath = DEFAULT_STEP41_REGRESSION_SAFETY_OUTPUT_PATH,
  arena = null,
  deterministic = true,
} = {}) {
  const report = summarizeStep41RegressionAndSafety({
    arena: arena ?? (await readJson(arenaPath)),
    deterministic,
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep41RegressionAndSafety();
  console.log(JSON.stringify(report, null, 2));
}
