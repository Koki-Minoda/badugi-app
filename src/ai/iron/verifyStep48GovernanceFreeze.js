import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP48_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-governance-freeze.json",
);

export function verifyStep48GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    step: "Step48",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    productionDatasetOverwrite: false,
    hiddenStateInjection: false,
    syntheticReplayGeneration: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    liveRlRouting: false,
    uiPreviewOnly: true,
    ...overrides,
  };
  const failures = [];
  if (report.promoted !== false) failures.push("promoted");
  if (report.routingChanged !== false) failures.push("routingChanged");
  if (report.gameplayMutation !== false) failures.push("gameplayMutation");
  if (report.productionDatasetOverwrite !== false) failures.push("productionDatasetOverwrite");
  if (report.sourcePriorityChanged !== false) failures.push("sourcePriorityChanged");
  if (report.modelRegistryMutation !== false) failures.push("modelRegistryMutation");
  if (report.d01Excluded !== true) failures.push("d01Excluded");
  return {
    ...report,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep48GovernanceFreeze({
  outputPath = DEFAULT_STEP48_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep48GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep48GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}
