import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP40_DRYRUN_GATE_PATH = path.resolve("reports/ai-iron/iron-step40-dryrun-gate.json");
export const DEFAULT_STEP40_GOVERNANCE_REFRESH_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step40-governance-refresh.json",
);

export function summarizeDryRunGovernanceState({ dryRunGate = {} } = {}) {
  return {
    generatedAt: new Date().toISOString(),
    datasetPath: dryRunGate.datasetPath ?? null,
    okForThreeVariantDryRun: Boolean(dryRunGate.okForThreeVariantDryRun),
    eligibleForPromotion: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function refreshDryRunGovernanceState({
  dryRunGatePath = DEFAULT_STEP40_DRYRUN_GATE_PATH,
  outputPath = DEFAULT_STEP40_GOVERNANCE_REFRESH_OUTPUT_PATH,
  dryRunGate = null,
} = {}) {
  const report = summarizeDryRunGovernanceState({
    dryRunGate: dryRunGate ?? (await readJson(dryRunGatePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await refreshDryRunGovernanceState();
  console.log(JSON.stringify(report, null, 2));
}
