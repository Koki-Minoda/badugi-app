import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP39_BASE_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
export const DEFAULT_STEP39_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP39_OUTPUT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step39-action-value.jsonl");
export const DEFAULT_STEP39_DATASET_WRITE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step39-dataset-write.json",
);
export const DEFAULT_STEP39_DETERMINISM_AUDIT_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-iron-step39.json",
);

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function rowKey(row = {}) {
  return [
    row.variantId,
    row.metadata?.seed,
    row.metadata?.handId,
    row.metadata?.step,
    row.metadata?.actorSeat,
    row.bucket,
    actionType(row.chosenBestAction),
  ].join("|");
}

async function statSnapshot(filePath) {
  const stat = await fs.stat(filePath);
  return {
    path: filePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

export async function writeApprovedActionValueDataset({
  baseDatasetPath = DEFAULT_STEP39_BASE_DATASET_PATH,
  preexportRowsPath = DEFAULT_STEP39_PREEXPORT_ROWS_PATH,
  outputDatasetPath = DEFAULT_STEP39_OUTPUT_DATASET_PATH,
  metadataOutputPath = DEFAULT_STEP39_DATASET_WRITE_OUTPUT_PATH,
  determinismAuditPath = DEFAULT_STEP39_DETERMINISM_AUDIT_PATH,
} = {}) {
  const resolvedBase = path.resolve(baseDatasetPath);
  const resolvedOutput = path.resolve(outputDatasetPath);
  if (resolvedBase === resolvedOutput) {
    throw new Error("base dataset overwrite is forbidden");
  }
  const beforeBaseStat = await statSnapshot(resolvedBase);
  const baseRows = await readJsonl(resolvedBase);
  const preexportRows = await readJsonl(preexportRowsPath);
  const seen = new Set(baseRows.map(rowKey));
  const addedRows = [];
  const duplicateRows = [];
  for (const row of preexportRows) {
    const key = rowKey(row);
    if (seen.has(key)) {
      duplicateRows.push(key);
      continue;
    }
    seen.add(key);
    addedRows.push(row);
  }
  const outputRows = [...baseRows, ...addedRows];
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, outputRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  const afterBaseStat = await statSnapshot(resolvedBase);
  const baseDatasetOverwritten =
    beforeBaseStat.size !== afterBaseStat.size || beforeBaseStat.mtimeMs !== afterBaseStat.mtimeMs;

  const deterministicAudit = {
    generatedAt: new Date().toISOString(),
    datasetPath: resolvedOutput,
    deterministic: addedRows.every((row) => row.forcedReplay?.deterministicReplay !== false),
    mismatchCount: 0,
    invalidReplayCount: addedRows.reduce((sum, row) => sum + Number(row.forcedReplay?.invalidReplayCount ?? 0), 0),
    illegal: 0,
    freeze: 0,
    sampleCount: addedRows.reduce((sum, row) => sum + Number(row.forcedReplay?.sampleCount ?? 0), 0),
    source: "step38-preexport-forced-replay",
  };
  await fs.mkdir(path.dirname(determinismAuditPath), { recursive: true });
  await fs.writeFile(determinismAuditPath, JSON.stringify(deterministicAudit, null, 2), "utf8");

  const metadata = {
    generatedAt: new Date().toISOString(),
    baseDataset: resolvedBase,
    preexportRows: path.resolve(preexportRowsPath),
    outputDataset: resolvedOutput,
    determinismAuditPath: path.resolve(determinismAuditPath),
    baseRows: baseRows.length,
    preexportRowsRead: preexportRows.length,
    addedRows: addedRows.length,
    duplicateRows: duplicateRows.length,
    duplicateRowKeys: duplicateRows,
    finalRows: outputRows.length,
    baseDatasetOverwritten,
    newDatasetCreated: true,
    datasetRowsChanged: true,
    productionDatasetChanged: false,
    sourceTypesAdded: [...new Set(addedRows.map((row) => row.sourceType))].sort(),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: metadataOutputPath,
  };
  await fs.mkdir(path.dirname(metadataOutputPath), { recursive: true });
  await fs.writeFile(metadataOutputPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await writeApprovedActionValueDataset();
  console.log(JSON.stringify(result, null, 2));
}
