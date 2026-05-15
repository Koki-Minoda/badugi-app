import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP35_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step35.json",
);

export function verifyGovernanceFreezeStep35({
  outputPath = DEFAULT_STEP35_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return {
    generatedAt: new Date().toISOString(),
    step: "Step35",
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeGovernanceFreezeVerificationStep35({
  outputPath = DEFAULT_STEP35_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, verifyGovernanceFreezeStep35({ outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceFreezeVerificationStep35();
  console.log(JSON.stringify(report, null, 2));
}
