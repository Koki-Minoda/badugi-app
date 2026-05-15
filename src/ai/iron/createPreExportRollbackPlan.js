import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP38_ROLLBACK_PLAN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/preexport-rollback-plan-step38.json",
);
export const DEFAULT_STEP38_BASE_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
export const DEFAULT_STEP38_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);

export async function createPreExportRollbackPlan({
  baseDataset = DEFAULT_STEP38_BASE_DATASET_PATH,
  preexportRows = DEFAULT_STEP38_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP38_ROLLBACK_PLAN_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, {
    generatedAt: new Date().toISOString(),
    baseDataset,
    preexportRows,
    actualDatasetMutation: false,
    rollbackRequired: false,
    rollbackReason: "Step38 writes preview artifacts only; base dataset is not overwritten.",
    step39IfApproved: "write new dataset file, do not overwrite base",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await createPreExportRollbackPlan();
  console.log(JSON.stringify(report, null, 2));
}
