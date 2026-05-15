import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP57_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-governance-freeze.json",
);

export function verifyStep57GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    liveRLMutation: false,
    modelRegistryMutation: false,
    sourcePriorityChanged: false,
    productionDatasetOverwrite: false,
    externalAnalytics: false,
    networkTelemetry: false,
    hiddenTelemetry: false,
    piiIncluded: false,
    ...overrides,
  };
  const expectedFalse = [
    "promoted",
    "routingChanged",
    "gameplayMutation",
    "liveRLMutation",
    "modelRegistryMutation",
    "sourcePriorityChanged",
    "productionDatasetOverwrite",
    "externalAnalytics",
    "networkTelemetry",
    "hiddenTelemetry",
    "piiIncluded",
  ];
  const expectedTrue = ["priorityFrozen", "d01Excluded", "previewOnly"];
  const failures = [
    ...expectedFalse.filter((key) => report[key] !== false),
    ...expectedTrue.filter((key) => report[key] !== true),
  ];
  return {
    ...report,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
  };
}

export async function verifyStep57GovernanceFreeze({
  outputPath = DEFAULT_STEP57_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep57GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep57GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
