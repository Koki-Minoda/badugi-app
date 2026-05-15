import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP44_SAFETY_OUTPUT_PATH = path.resolve("reports/ai-iron/step44-safety.json");

export function summarizeStep44Safety({ step43Safety = {}, determinism = {} } = {}) {
  const failures = [];
  if (Number(step43Safety.illegal ?? 0) > 0) failures.push("illegal-action-present");
  if (Number(step43Safety.freeze ?? 0) > 0) failures.push("freeze-present");
  if (determinism.deterministic !== true || Number(determinism.mismatchCount ?? 0) > 0) failures.push("determinism-failure");
  return {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "FAIL" : "PASS",
    verdict: failures.length ? "FAIL" : "SAFE",
    reason: failures.length ? failures : ["unsafe-not-observed", "scarcity-diagnosis-only"],
    illegal: Number(step43Safety.illegal ?? 0),
    freeze: Number(step43Safety.freeze ?? 0),
    deterministic: determinism.deterministic === true,
    mismatchCount: Number(determinism.mismatchCount ?? 0),
    invalidReplayCount: Number(determinism.invalidReplayCount ?? 0),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function auditStep44Safety({
  step43SafetyPath = path.resolve("reports/ai-iron/step43-safety.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-iron-step44.json"),
  outputPath = DEFAULT_STEP44_SAFETY_OUTPUT_PATH,
  step43Safety = null,
  determinism = null,
} = {}) {
  const report = summarizeStep44Safety({
    step43Safety: step43Safety ?? (await readJson(step43SafetyPath)),
    determinism: determinism ?? (await readJson(determinismPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditStep44Safety();
  console.log(JSON.stringify(report, null, 2));
}
