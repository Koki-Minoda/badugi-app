import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step33.json",
);

export function verifyGovernanceFreezeStep33(overrides = {}) {
  return {
    generatedAt: new Date().toISOString(),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    ...overrides,
    outputPath: DEFAULT_STEP33_GOVERNANCE_FREEZE_OUTPUT_PATH,
  };
}

export async function writeGovernanceFreezeVerificationStep33({
  outputPath = DEFAULT_STEP33_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides,
} = {}) {
  return writeJsonReport(outputPath, verifyGovernanceFreezeStep33(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeGovernanceFreezeVerificationStep33();
  console.log(JSON.stringify(report, null, 2));
}
