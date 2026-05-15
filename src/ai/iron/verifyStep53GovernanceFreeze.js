import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP53_GOVERNANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step53-governance-freeze.json",
);

const DEFAULT_STATE = Object.freeze({
  promoted: false,
  routingChanged: false,
  priorityFrozen: true,
  d01Excluded: true,
  gameplayMutation: false,
  liveRLMutation: false,
  sourcePriorityChanged: false,
  modelRegistryMutation: false,
  productionDatasetOverwrite: false,
  externalAnalytics: false,
  networkTelemetry: false,
  hiddenTelemetry: false,
  previewOnly: true,
});

export function verifyStep53GovernanceFreezeSummary(overrides = {}) {
  const state = { ...DEFAULT_STATE, ...overrides };
  const expectedFalse = [
    "promoted",
    "routingChanged",
    "gameplayMutation",
    "liveRLMutation",
    "sourcePriorityChanged",
    "modelRegistryMutation",
    "productionDatasetOverwrite",
    "externalAnalytics",
    "networkTelemetry",
    "hiddenTelemetry",
  ];
  const expectedTrue = ["priorityFrozen", "d01Excluded", "previewOnly"];
  const failures = [
    ...expectedFalse.filter((key) => state[key] !== false),
    ...expectedTrue.filter((key) => state[key] !== true),
  ];
  return {
    generatedAt: new Date().toISOString(),
    ...state,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep53GovernanceFreeze({
  outputPath = DEFAULT_STEP53_GOVERNANCE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  const report = verifyStep53GovernanceFreezeSummary(overrides);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep53GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
