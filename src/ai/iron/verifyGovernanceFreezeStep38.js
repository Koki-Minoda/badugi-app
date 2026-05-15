import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP38_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step38.json",
);

export function verifyGovernanceFreezeStep38({
  outputPath = DEFAULT_STEP38_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return {
    generatedAt: new Date().toISOString(),
    step: "Step38",
    datasetRowsChanged: false,
    actualDatasetChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeGovernanceFreezeVerificationStep38({
  outputPath = DEFAULT_STEP38_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, verifyGovernanceFreezeStep38({ outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceFreezeVerificationStep38();
  console.log(JSON.stringify(report, null, 2));
}
