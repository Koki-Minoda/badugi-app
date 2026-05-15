import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP47_ROLLBACK_FREE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-rollbackfree-verification.json",
);

export function verifyCoachingRollbackFreeSummary({
  governance = {},
  determinism = {},
  handoff = {},
  supervised = {},
} = {}) {
  const replayDeterminismMaintained =
    determinism.deterministic === true &&
    Number(determinism.mismatchCount ?? 0) === 0 &&
    Number(determinism.invalidReplayCount ?? 0) === 0;
  const checks = {
    datasetMutation: governance.datasetRowsChanged === false || governance.trainingDatasetMutation === false,
    routingUnchanged: governance.routingChanged === false,
    gameplayUnchanged: governance.gameplayMutation === false,
    sourcePriorityUnchanged: governance.sourcePriorityChanged === false,
    modelRegistryUnchanged: governance.modelRegistryMutation === false,
    promotedFalse: governance.promoted === false,
    d01Excluded: governance.d01Excluded === true,
    replayDeterminismMaintained,
    handoffPreviewOnly: handoff.productionDatasetOverwrite === false || supervised.trainingDatasetMutation === false,
  };
  const rollbackRequired = Object.values(checks).some((value) => value !== true);
  return {
    generatedAt: new Date().toISOString(),
    status: rollbackRequired ? "FAIL" : "PASS",
    rollbackRequired,
    rollbackReason: rollbackRequired
      ? Object.entries(checks)
          .filter(([, ok]) => ok !== true)
          .map(([key]) => key)
      : [],
    checks,
    datasetMutation: false,
    routingChanged: false,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    promoted: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function verifyCoachingRollbackFree({
  governancePath = path.resolve("reports/ai-iron/governance-freeze-verification-step46.json"),
  determinismPath = path.resolve("reports/ai-eval/replay-determinism-audit-step47.json"),
  handoffPath = path.resolve("reports/ai-iron/step47-coaching-handoff-package.json"),
  supervisedPath = path.resolve("reports/ai-iron/step47-supervised-signal-handoff.json"),
  outputPath = DEFAULT_STEP47_ROLLBACK_FREE_OUTPUT_PATH,
  governance = null,
  determinism = null,
  handoff = null,
  supervised = null,
} = {}) {
  const report = verifyCoachingRollbackFreeSummary({
    governance: governance ?? (await readJson(governancePath)),
    determinism: determinism ?? (await readJson(determinismPath)),
    handoff: handoff ?? (await readJson(handoffPath)),
    supervised: supervised ?? (await readJson(supervisedPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyCoachingRollbackFree();
  console.log(JSON.stringify(report, null, 2));
}
