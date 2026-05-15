import path from "node:path";

import { STEP42_ARENA_PATHS, summarizeArenaRepeatability } from "./aggregateStep42Repeatability.js";
import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP42_DETERMINISM_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step42.json",
);
export const DEFAULT_STEP42_REGRESSION_SAFETY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step42-regression-safety.json",
);

export function summarizeStep42RegressionSafety({ arenas = [], determinism = {} } = {}) {
  const runs = arenas.map((arena, index) => summarizeArenaRepeatability(arena, index === 0 ? "A" : index === 1 ? "B" : `run-${index + 1}`));
  const illegal = runs.reduce((sum, run) => sum + run.illegal, 0);
  const freeze = runs.reduce((sum, run) => sum + run.freeze, 0);
  const worstIronProGap = runs.reduce((worst, run) => Math.min(worst, run.ironProGap), Number.POSITIVE_INFINITY);
  const failures = [];
  if (illegal > 0) failures.push("illegal-action-present");
  if (freeze > 0) failures.push("freeze-present");
  if (determinism.deterministic !== true) failures.push("determinism-break");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) failures.push("catastrophic-iron-pro-regression");
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    status: failures.length ? "FAIL" : "PASS",
    verdict: failures.length ? "FAIL" : "SAFE",
    reason: failures.length ? failures : ["no-catastrophic-regression", "all-safety-gates-clear"],
    illegal,
    freeze,
    deterministic: determinism.deterministic === true,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    invalidReplayCount: Number(determinism.invalidReplayCount ?? 0),
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
    runs,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function auditStep42RegressionSafety({
  arenaPaths = STEP42_ARENA_PATHS,
  determinismPath = DEFAULT_STEP42_DETERMINISM_PATH,
  outputPath = DEFAULT_STEP42_REGRESSION_SAFETY_OUTPUT_PATH,
  arenas = null,
  determinism = null,
} = {}) {
  const loadedArenas = arenas ?? (await Promise.all(arenaPaths.map((arenaPath) => readJson(arenaPath))));
  const report = summarizeStep42RegressionSafety({
    arenas: loadedArenas,
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep42RegressionSafety();
  console.log(JSON.stringify(report, null, 2));
}
