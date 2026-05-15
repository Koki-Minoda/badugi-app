import fs from "node:fs/promises";
import path from "node:path";

import { validateActionValueRow } from "./loadActionValueDataset.js";
import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP38_PREEXPORT_ROWS_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP38_PREEXPORT_VALIDATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/preexport-validation-step38.json",
);

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function legalActionsInclude(row = {}, action = null) {
  const wanted = actionType(action);
  return (row.legalActions ?? []).some((legalAction) => actionType(legalAction) === wanted);
}

export async function readPreExportRows(preexportRowsPath = DEFAULT_STEP38_PREEXPORT_ROWS_PATH) {
  const content = await fs.readFile(preexportRowsPath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function validateRow(row = {}) {
  const failures = [];
  const baseValidation = validateActionValueRow(row);
  failures.push(...baseValidation.reasons.map((reason) => `schema:${reason}`));
  if (!row.forcedReplay || typeof row.forcedReplay !== "object") failures.push("forcedReplay-missing");
  if (Number(row.forcedReplay?.invalidReplayCount ?? 1) !== 0) failures.push("invalidReplayCount");
  if (Number(row.forcedReplay?.confidence ?? 0) < 0.8) failures.push("confidence");
  if (Number(row.forcedReplay?.signFlipRate ?? 1) > 0.1) failures.push("signFlipRate");
  if (Number(row.forcedReplay?.sampleCount ?? 0) < 50) failures.push("sampleCount");
  if (String(row.variantId ?? "").toUpperCase() === "D01") failures.push("D01-included");
  if (row.governance?.promoted !== false) failures.push("promoted");
  if (row.governance?.routingChanged !== false) failures.push("routingChanged");
  if (row.governance?.priorityFrozen !== true) failures.push("priorityFrozen");
  if (row.governance?.d01Excluded !== true) failures.push("d01Excluded");
  if (!legalActionsInclude(row, row.chosenBestAction)) failures.push("chosenBestAction-illegal");
  if (!legalActionsInclude(row, row.rejectedAction)) failures.push("rejectedAction-illegal");
  for (const candidate of row.candidateActions ?? []) {
    if (!legalActionsInclude(row, candidate.action)) failures.push("candidateAction-illegal");
  }
  return [...new Set(failures)];
}

export async function validatePreExportPackage({
  preexportRowsPath = DEFAULT_STEP38_PREEXPORT_ROWS_PATH,
  outputPath = DEFAULT_STEP38_PREEXPORT_VALIDATION_OUTPUT_PATH,
} = {}) {
  const rows = await readPreExportRows(preexportRowsPath);
  const rowResults = rows.map((row, index) => ({
    index,
    playerCount: row.playerCount ?? row.metadata?.playerCount ?? null,
    valid: validateRow(row).length === 0,
    failures: validateRow(row),
  }));
  const failures = rowResults.flatMap((result) => result.failures);
  const gates = {
    schema: rowResults.every((row) => !row.failures.some((failure) => failure.startsWith("schema:"))) ? "PASS" : "FAIL",
    forcedReplayMetadata:
      rowResults.every((row) => !row.failures.some((failure) => failure.startsWith("forcedReplay") || failure === "invalidReplayCount"))
        ? "PASS"
        : "FAIL",
    thresholds:
      rowResults.every((row) => !row.failures.some((failure) => ["confidence", "signFlipRate", "sampleCount"].includes(failure)))
        ? "PASS"
        : "FAIL",
    governanceFreeze:
      rowResults.every((row) =>
        !row.failures.some((failure) =>
          ["D01-included", "promoted", "routingChanged", "priorityFrozen", "d01Excluded"].includes(failure),
        ),
      )
        ? "PASS"
        : "FAIL",
    legalAction:
      rowResults.every((row) => !row.failures.some((failure) => failure.includes("illegal"))) ? "PASS" : "FAIL",
  };
  const status = rows.length === 0 || Object.values(gates).includes("FAIL") ? "FAIL" : failures.length ? "WARN" : "PASS";
  return writeJsonReport(outputPath, {
    generatedAt: new Date().toISOString(),
    preexportRows: preexportRowsPath,
    status,
    rowCount: rows.length,
    validRows: rowResults.filter((row) => row.valid).length,
    invalidRows: rowResults.filter((row) => !row.valid).length,
    gates,
    rowResults,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await validatePreExportPackage();
  console.log(JSON.stringify(report, null, 2));
}
