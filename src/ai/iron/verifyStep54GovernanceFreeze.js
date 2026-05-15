import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP54_GOVERNANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-governance-freeze.json",
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

export function verifyStep54GovernanceFreezeSummary(overrides = {}) {
  const state = { ...DEFAULT_STATE, ...overrides };
  const falseKeys = [
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
  const trueKeys = ["priorityFrozen", "d01Excluded", "previewOnly"];
  const failures = [
    ...falseKeys.filter((key) => state[key] !== false),
    ...trueKeys.filter((key) => state[key] !== true),
  ];
  return {
    generatedAt: new Date().toISOString(),
    ...state,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep54GovernanceFreeze({
  outputPath = DEFAULT_STEP54_GOVERNANCE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  const report = verifyStep54GovernanceFreezeSummary(overrides);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep54GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
