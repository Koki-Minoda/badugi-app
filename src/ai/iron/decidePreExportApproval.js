import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP38_VALIDATION_PATH = path.resolve("reports/ai-iron/preexport-validation-step38.json");
export const DEFAULT_STEP38_DIFF_PREVIEW_PATH = path.resolve("reports/ai-iron/dataset-diff-preview-step38.json");
export const DEFAULT_STEP38_ROLLBACK_PLAN_PATH = path.resolve("reports/ai-iron/preexport-rollback-plan-step38.json");
export const DEFAULT_STEP38_GOVERNANCE_FREEZE_PATH = path.resolve(
  "reports/ai-iron/governance-freeze-verification-step38.json",
);
export const DEFAULT_STEP38_APPROVAL_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/preexport-approval-step38.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function freezeIntact(report = {}) {
  return (
    report.datasetRowsChanged === false &&
    report.promoted === false &&
    report.routingChanged === false &&
    report.priorityFrozen === true &&
    report.d01Excluded === true &&
    report.gameplayMutation === false &&
    report.sourcePriorityChanged === false
  );
}

export async function decidePreExportApproval({
  validationPath = DEFAULT_STEP38_VALIDATION_PATH,
  diffPreviewPath = DEFAULT_STEP38_DIFF_PREVIEW_PATH,
  rollbackPlanPath = DEFAULT_STEP38_ROLLBACK_PLAN_PATH,
  governanceFreezePath = DEFAULT_STEP38_GOVERNANCE_FREEZE_PATH,
  outputPath = DEFAULT_STEP38_APPROVAL_OUTPUT_PATH,
  validationReport = null,
  diffPreviewReport = null,
  rollbackPlan = null,
  governanceFreeze = null,
} = {}) {
  const validation = validationReport ?? (await readJsonIfExists(validationPath));
  const diff = diffPreviewReport ?? (await readJsonIfExists(diffPreviewPath));
  const rollback = rollbackPlan ?? (await readJsonIfExists(rollbackPlanPath));
  const freeze = governanceFreeze ?? (await readJsonIfExists(governanceFreezePath));
  const reasons = [];
  if (validation?.status !== "PASS") reasons.push("preexport-validation-not-pass");
  if ((diff?.highRiskFlags ?? []).length) reasons.push("dataset-diff-high-risk");
  if (!rollback || rollback.actualDatasetMutation !== false) reasons.push("rollback-plan-missing-or-mutating");
  if (!freezeIntact(freeze ?? {})) reasons.push("governance-freeze-not-intact");
  const approval = reasons.length === 0 ? "APPROVED_FOR_STEP39_EXPORT" : reasons.includes("dataset-diff-high-risk") ? "REJECT" : "HOLD";
  return writeJsonReport(outputPath, {
    generatedAt: new Date().toISOString(),
    approval,
    reason: reasons.length ? reasons : ["all-gates-pass"],
    validationStatus: validation?.status ?? "MISSING",
    highRiskFlags: diff?.highRiskFlags ?? ["diff-preview-missing"],
    rollbackPlanExists: Boolean(rollback),
    governanceFreezeIntact: freezeIntact(freeze ?? {}),
    actualDatasetMutation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await decidePreExportApproval();
  console.log(JSON.stringify(report, null, 2));
}
