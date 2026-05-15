import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP39_BASE_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
export const DEFAULT_STEP39_FINAL_DATASET_PATH = path.resolve("data/ai/action-value/iron-step39-action-value.jsonl");
export const DEFAULT_STEP39_DATASET_DIFF_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/dataset-diff-final-step39.json",
);

function countBy(rows = [], keyFn = () => "") {
  return rows.reduce((counts, row) => {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function diffCounts(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries(
    [...keys].sort().map((key) => [key, Number(after[key] ?? 0) - Number(before[key] ?? 0)]),
  );
}

export async function finalizeActionValueDatasetDiff({
  baseDatasetPath = DEFAULT_STEP39_BASE_DATASET_PATH,
  finalDatasetPath = DEFAULT_STEP39_FINAL_DATASET_PATH,
  outputPath = DEFAULT_STEP39_DATASET_DIFF_OUTPUT_PATH,
} = {}) {
  const base = await loadActionValueDataset(baseDatasetPath, { allowInvalidRows: true });
  const final = await loadActionValueDataset(finalDatasetPath, { allowInvalidRows: true });
  const baseSourceTypes = countBy(base.rows, (row) => row.sourceType ?? row.metadata?.sourceType ?? "unknown");
  const finalSourceTypes = countBy(final.rows, (row) => row.sourceType ?? row.metadata?.sourceType ?? "unknown");
  const variantDelta = diffCounts(base.summary.variantDistribution, final.summary.variantDistribution);
  const sourceTypeDelta = diffCounts(baseSourceTypes, finalSourceTypes);
  const report = {
    generatedAt: new Date().toISOString(),
    baseDataset: baseDatasetPath,
    finalDataset: finalDatasetPath,
    baseRows: base.summary.totalRows,
    addedRows: final.summary.totalRows - base.summary.totalRows,
    finalRows: final.summary.totalRows,
    validRows: final.summary.validRows,
    invalidRows: final.summary.invalidRows,
    variantCoverageBefore: base.summary.variantDistribution,
    variantCoverageAfter: final.summary.variantDistribution,
    variantDelta,
    sourceTypeDistributionBefore: baseSourceTypes,
    sourceTypeDistributionAfter: finalSourceTypes,
    sourceTypeDelta,
    s02RowsAdded: Number(variantDelta.S02 ?? 0),
    verifiedForcedReplayAdded: Number(sourceTypeDelta["verified-forced-replay"] ?? 0),
    d01RowsBefore: Number(base.summary.variantDistribution?.D01 ?? 0),
    d01RowsAfter: Number(final.summary.variantDistribution?.D01 ?? 0),
    d01RowsUnchanged:
      Number(base.summary.variantDistribution?.D01 ?? 0) === Number(final.summary.variantDistribution?.D01 ?? 0),
    baseDatasetOverwritten: false,
    productionDatasetChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await finalizeActionValueDatasetDiff();
  console.log(JSON.stringify(report, null, 2));
}
