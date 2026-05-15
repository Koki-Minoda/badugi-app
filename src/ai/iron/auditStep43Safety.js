import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP43_MIXED_ARENA_PATH = path.resolve("reports/ai-iron/iron-step43-mixed-arena.json");
export const DEFAULT_STEP43_DETERMINISM_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step43.json",
);
export const DEFAULT_STEP43_SAFETY_OUTPUT_PATH = path.resolve("reports/ai-iron/step43-safety.json");

export function summarizeStep43Safety({ arena = {}, determinism = {} } = {}) {
  const rows = (arena.results ?? []).map((result) => ({
    variant: result.variant,
    ironProGap: roundNumber(result.ironProGap, 4),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
  }));
  const illegal = rows.reduce((sum, row) => sum + row.illegal, 0);
  const freeze = rows.reduce((sum, row) => sum + row.freeze, 0);
  const worstIronProGap = rows.reduce((worst, row) => Math.min(worst, row.ironProGap), Number.POSITIVE_INFINITY);
  const failures = [];
  if (illegal > 0) failures.push("illegal-action-present");
  if (freeze > 0) failures.push("freeze-present");
  if (determinism.deterministic !== true || Number(determinism.mismatchCount ?? 0) > 0) failures.push("determinism-failure");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) failures.push("catastrophic-iron-pro-regression");
  return {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "FAIL" : "PASS",
    verdict: failures.length ? "FAIL" : "SAFE",
    reason: failures.length ? failures : ["all-safety-gates-clear"],
    illegal,
    freeze,
    deterministic: determinism.deterministic === true,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    invalidReplayCount: Number(determinism.invalidReplayCount ?? 0),
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

export async function auditStep43Safety({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  determinismPath = DEFAULT_STEP43_DETERMINISM_PATH,
  outputPath = DEFAULT_STEP43_SAFETY_OUTPUT_PATH,
  arena = null,
  determinism = null,
} = {}) {
  const report = summarizeStep43Safety({
    arena: arena ?? (await readJson(arenaPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep43Safety();
  console.log(JSON.stringify(report, null, 2));
}
