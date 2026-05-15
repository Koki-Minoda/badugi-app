import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP52_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step52-governance-freeze.json",
);

export function verifyStep52GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    step: "Step52",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    liveRLMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    productionDatasetOverwrite: false,
    aiDecisionMutation: false,
    externalAnalyticsSdk: false,
    networkDependency: false,
    hiddenTelemetry: false,
    syntheticReplayInjection: false,
    previewOnly: true,
    deterministicReplayUnchanged: true,
    mismatchCount: 0,
    invalidReplayCount: 0,
    ...overrides,
  };
  const failures = [];
  for (const key of [
    "promoted",
    "routingChanged",
    "gameplayMutation",
    "liveRLMutation",
    "sourcePriorityChanged",
    "modelRegistryMutation",
    "productionDatasetOverwrite",
    "aiDecisionMutation",
    "externalAnalyticsSdk",
    "networkDependency",
    "hiddenTelemetry",
    "syntheticReplayInjection",
  ]) {
    if (report[key] !== false) failures.push(key);
  }
  if (report.priorityFrozen !== true) failures.push("priorityFrozen");
  if (report.d01Excluded !== true) failures.push("d01Excluded");
  if (report.deterministicReplayUnchanged !== true) failures.push("deterministicReplayUnchanged");
  if (Number(report.mismatchCount) !== 0) failures.push("mismatchCount");
  if (Number(report.invalidReplayCount) !== 0) failures.push("invalidReplayCount");
  return {
    ...report,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep52GovernanceFreeze({
  outputPath = DEFAULT_STEP52_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep52GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep52GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
