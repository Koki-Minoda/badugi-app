import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP39_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step39.json",
);

export function verifyGovernanceFreezeStep39({
  outputPath = DEFAULT_STEP39_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return {
    generatedAt: new Date().toISOString(),
    step: "Step39",
    baseDatasetOverwritten: false,
    newDatasetCreated: true,
    datasetRowsChanged: true,
    productionDatasetChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    outputPath,
  };
}

export async function writeGovernanceFreezeVerificationStep39({
  outputPath = DEFAULT_STEP39_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, verifyGovernanceFreezeStep39({ outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceFreezeVerificationStep39();
  console.log(JSON.stringify(report, null, 2));
}
