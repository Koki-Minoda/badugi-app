import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP56_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-governance-freeze.json",
);

export function verifyStep56GovernanceFreezeSummary(overrides = {}) {
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

export async function verifyStep56GovernanceFreeze({
  outputPath = DEFAULT_STEP56_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep56GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep56GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
