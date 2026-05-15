import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP58_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step58-governance-freeze.json",
);

export function verifyStep58GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    promoted: false,
    routingChanged: false,
    gameplayMutation: false,
    liveRLMutation: false,
    modelRegistryMutation: false,
    sourcePriorityChanged: false,
    productionDatasetOverwrite: false,
    backendAnalytics: false,
    externalAnalytics: false,
    networkTelemetry: false,
    hiddenTelemetry: false,
    d01Included: false,
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
    "backendAnalytics",
    "externalAnalytics",
    "networkTelemetry",
    "hiddenTelemetry",
    "d01Included",
  ];
  const expectedTrue = ["previewOnly"];
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

export async function verifyStep58GovernanceFreeze({
  outputPath = DEFAULT_STEP58_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep58GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep58GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
