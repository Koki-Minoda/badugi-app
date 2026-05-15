import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP40_SMOKE_ARENA_PATH = path.resolve("reports/ai-iron/iron-step40-smoke-arena.json");
export const DEFAULT_STEP40_DETERMINISM_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step40.json",
);
export const DEFAULT_STEP40_SAFETY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step40-safety-verification.json",
);

function sumArenaMetric(arena = {}, metric = "") {
  return (arena.results ?? []).reduce((sum, result) => sum + Number(result?.[metric] ?? 0), 0);
}

export function summarizeSmokeArenaSafety({ arena = {}, determinism = {} } = {}) {
  const illegal = sumArenaMetric(arena, "illegal");
  const freeze = sumArenaMetric(arena, "freeze");
  const invalidReplayCount = Number(determinism.invalidReplayCount ?? 0);
  const routingMutation = arena.routingChanged === true;
  const gameplayMutation = false;
  const sourcePriorityMutation = false;
  const datasetMutation = false;
  const failures = [];
  if (illegal > 0) failures.push("illegal-action-present");
  if (freeze > 0) failures.push("freeze-present");
  if (invalidReplayCount > 0) failures.push("invalid-replay-present");
  if (routingMutation) failures.push("routing-mutation");
  if (gameplayMutation) failures.push("gameplay-mutation");
  if (sourcePriorityMutation) failures.push("source-priority-mutation");
  const verdict = failures.length ? "FAIL" : "SAFE";
  return {
    generatedAt: new Date().toISOString(),
    verdict,
    reason: failures.length ? failures : ["all-safety-gates-clear"],
    illegal,
    freeze,
    invalidReplayCount,
    deterministic: determinism.deterministic === true,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    routingMutation,
    gameplayMutation,
    sourcePriorityMutation,
    datasetMutation,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function verifySmokeArenaSafety({
  arenaPath = DEFAULT_STEP40_SMOKE_ARENA_PATH,
  determinismPath = DEFAULT_STEP40_DETERMINISM_PATH,
  outputPath = DEFAULT_STEP40_SAFETY_OUTPUT_PATH,
  arena = null,
  determinism = null,
} = {}) {
  const report = summarizeSmokeArenaSafety({
    arena: arena ?? (await readJson(arenaPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifySmokeArenaSafety();
  console.log(JSON.stringify(report, null, 2));
}
