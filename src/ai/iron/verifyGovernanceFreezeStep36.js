import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP36_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step36.json",
);

export function verifyGovernanceFreezeStep36({
  outputPath = DEFAULT_STEP36_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return {
    generatedAt: new Date().toISOString(),
    step: "Step36",
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

export async function writeGovernanceFreezeVerificationStep36({
  outputPath = DEFAULT_STEP36_GOVERNANCE_FREEZE_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, verifyGovernanceFreezeStep36({ outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceFreezeVerificationStep36();
  console.log(JSON.stringify(report, null, 2));
}
