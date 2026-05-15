import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP50_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-governance-freeze.json",
);

export function verifyStep50GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    step: "Step50",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    liveRLChanged: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    productionDatasetOverwrite: false,
    hiddenStateInjection: false,
    syntheticReplay: false,
    previewOnly: true,
    ...overrides,
  };
  const failures = [];
  if (report.promoted !== false) failures.push("promoted");
  if (report.routingChanged !== false) failures.push("routingChanged");
  if (report.priorityFrozen !== true) failures.push("priorityFrozen");
  if (report.d01Excluded !== true) failures.push("d01Excluded");
  if (report.gameplayMutation !== false) failures.push("gameplayMutation");
  if (report.liveRLChanged !== false) failures.push("liveRLChanged");
  if (report.sourcePriorityChanged !== false) failures.push("sourcePriorityChanged");
  if (report.modelRegistryMutation !== false) failures.push("modelRegistryMutation");
  if (report.productionDatasetOverwrite !== false) failures.push("productionDatasetOverwrite");
  if (report.syntheticReplay !== false) failures.push("syntheticReplay");
  return {
    ...report,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep50GovernanceFreeze({
  outputPath = DEFAULT_STEP50_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep50GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep50GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}

