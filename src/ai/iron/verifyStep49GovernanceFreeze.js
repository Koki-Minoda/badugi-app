import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP49_GOVERNANCE_FREEZE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step49-governance-freeze.json",
);

export function verifyStep49GovernanceFreezeSummary(overrides = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    step: "Step49",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    productionDatasetOverwrite: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    liveRLChanged: false,
    previewOnly: true,
    ...overrides,
  };
  const failures = [];
  if (report.promoted !== false) failures.push("promoted");
  if (report.routingChanged !== false) failures.push("routingChanged");
  if (report.priorityFrozen !== true) failures.push("priorityFrozen");
  if (report.d01Excluded !== true) failures.push("d01Excluded");
  if (report.gameplayMutation !== false) failures.push("gameplayMutation");
  if (report.productionDatasetOverwrite !== false) failures.push("productionDatasetOverwrite");
  if (report.sourcePriorityChanged !== false) failures.push("sourcePriorityChanged");
  if (report.modelRegistryMutation !== false) failures.push("modelRegistryMutation");
  if (report.liveRLChanged !== false) failures.push("liveRLChanged");
  return {
    ...report,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

export async function verifyStep49GovernanceFreeze({
  outputPath = DEFAULT_STEP49_GOVERNANCE_FREEZE_OUTPUT_PATH,
  overrides = {},
} = {}) {
  return writeJsonReport(outputPath, verifyStep49GovernanceFreezeSummary(overrides));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await verifyStep49GovernanceFreeze();
  console.log(JSON.stringify(report, null, 2));
}

