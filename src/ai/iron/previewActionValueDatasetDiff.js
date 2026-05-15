import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { readPreExportRows } from "./validatePreExportPackage.js";
import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP38_BASE_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
export const DEFAULT_STEP38_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP38_DATASET_DIFF_PREVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/dataset-diff-preview-step38.json",
);

function countBy(rows = [], keyFn = () => "") {
  return rows.reduce((counts, row) => {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function mergeCounts(left = {}, right = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries([...keys].sort().map((key) => [key, (left[key] ?? 0) + (right[key] ?? 0)]));
}

function rowKey(row = {}) {
  return [
    row.variantId,
    row.metadata?.seed,
    row.metadata?.handId,
    row.metadata?.step,
    row.metadata?.actorSeat,
    row.bucket,
    row.chosenBestAction?.type ?? row.chosenBestAction,
  ].join("|");
}

async function fileLineCount(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return content.split("\n").map((line) => line.trim()).filter(Boolean).length;
}

export async function previewActionValueDatasetDiff({
  baseDatasetPath = DEFAULT_STEP38_BASE_DATASET_PATH,
  preexportRowsPath = DEFAULT_STEP38_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP38_DATASET_DIFF_PREVIEW_OUTPUT_PATH,
} = {}) {
  const base = await loadActionValueDataset(baseDatasetPath, { allowInvalidRows: true });
  const preexportRows = await readPreExportRows(preexportRowsPath);
  const baseRows = await fileLineCount(baseDatasetPath);
  const addedRows = preexportRows.length;
  const duplicateKeys = new Set(base.rows.map(rowKey));
  const riskFlags = [];
  if (preexportRows.some((row) => row.variantId === "D01")) riskFlags.push("d01-row-present");
  if (preexportRows.some((row) => duplicateKeys.has(rowKey(row)))) riskFlags.push("duplicate-row-key");
  if (preexportRows.some((row) => row.governance?.routingChanged || row.governance?.promoted)) {
    riskFlags.push("governance-freeze-violation");
  }
  if (preexportRows.some((row) => row.forcedReplay?.invalidReplayCount !== 0)) riskFlags.push("invalid-replay-present");

  const preVariantCoverage = countBy(preexportRows, (row) => row.variantId);
  const preSourceTypes = countBy(preexportRows, (row) => row.sourceType ?? "unknown");
  const variantCoverageBefore = base.summary.variantDistribution ?? {};
  const sourceTypeDistributionBefore = countBy(base.rows, (row) => row.sourceType ?? row.metadata?.sourceType ?? "unknown");
  const preview = {
    generatedAt: new Date().toISOString(),
    baseDataset: baseDatasetPath,
    preexportRows: preexportRowsPath,
    actualDatasetMutation: false,
    baseRows,
    addedRows,
    projectedRows: baseRows + addedRows,
    variantCoverageBefore,
    variantCoverageAfter: mergeCounts(variantCoverageBefore, preVariantCoverage),
    sourceTypeDistributionBefore,
    sourceTypeDistributionAfter: mergeCounts(sourceTypeDistributionBefore, preSourceTypes),
    riskFlags,
    highRiskFlags: riskFlags.filter((flag) => ["d01-row-present", "governance-freeze-violation"].includes(flag)),
  };
  return writeJsonReport(outputPath, preview);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await previewActionValueDatasetDiff();
  console.log(JSON.stringify(report, null, 2));
}
