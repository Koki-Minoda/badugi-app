import fs from "node:fs/promises";

const DATASET_SCHEMA_VERSION = 1;
export const ACTION_VALUE_OBSERVATION_SIZE = 96;

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function normalizeLegacyRow(row = {}) {
  return {
    ...row,
    sourceCorpusTag: row.sourceCorpusTag ?? row.metadata?.sampleTag ?? "",
    sourceCounterfactualScore:
      row.sourceCounterfactualScore ?? row.metadata?.counterfactualReportPath ?? "",
    trainingWeight:
      row.trainingWeight ??
      (() => {
        const confidence =
          Number(row.candidateActions?.[0]?.confidence ?? row.candidateActions?.[1]?.confidence ?? 0) || 0;
        const sampleCount =
          Number(row.candidateActions?.[0]?.sampleCount ?? row.candidateActions?.[1]?.sampleCount ?? 0) || 0;
        return Number((confidence * Math.min(1, sampleCount / 50)).toFixed(4));
      })(),
  };
}

function isLegalAction(action = null, legalActions = []) {
  const wanted = actionType(action);
  return legalActions.some((legalAction) => actionType(legalAction) === wanted);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function bucketConfidenceBand(confidence = 0) {
  const numeric = Number(confidence) || 0;
  if (numeric >= 0.9) return "0.90-1.00";
  if (numeric >= 0.8) return "0.80-0.89";
  if (numeric >= 0.7) return "0.70-0.79";
  if (numeric >= 0.5) return "0.50-0.69";
  return "0.00-0.49";
}

function incrementDistribution(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function validateActionValueRow(row = {}) {
  const reasons = [];
  if (!String(row.variantId ?? "").length) reasons.push("variantId");
  if (row.schemaVersion !== DATASET_SCHEMA_VERSION) reasons.push("schemaVersion");
  if (
    !Array.isArray(row.observation) ||
    row.observation.length !== ACTION_VALUE_OBSERVATION_SIZE ||
    row.observation.some((value) => !isFiniteNumber(value))
  ) {
    reasons.push("observation");
  }
  if (!Array.isArray(row.legalActions) || !row.legalActions.length) reasons.push("legalActions");
  if (!Array.isArray(row.candidateActions) || !row.candidateActions.length) reasons.push("candidateActions");
  if (!row.chosenBestAction) reasons.push("chosenBestAction");
  if (!String(row.bucket ?? "").length) reasons.push("bucket");
  if (!String(row.handClass ?? "").length) reasons.push("handClass");
  if (!String(row.sourceCorpusTag ?? "").length) reasons.push("sourceCorpusTag");
  if (!String(row.sourceCounterfactualScore ?? "").length) reasons.push("sourceCounterfactualScore");
  if (!isFiniteNumber(row.trainingWeight) || Number(row.trainingWeight) < 0) reasons.push("trainingWeight");

  for (const candidate of row.candidateActions ?? []) {
    if (!candidate || typeof candidate !== "object") {
      reasons.push("candidateShape");
      continue;
    }
    if (!String(candidate.source ?? "").length) reasons.push("candidateSource");
    if (!isFiniteNumber(candidate.estimatedValue)) reasons.push("estimatedValue");
    if (!isFiniteNumber(candidate.sampleCount)) reasons.push("sampleCount");
    const confidence = Number(candidate.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) reasons.push("confidence");
    if (!String(candidate.verdict ?? "").length) reasons.push("verdict");
    if (!isLegalAction(candidate.action, row.legalActions ?? [])) reasons.push("candidateIllegal");
  }

  if (!isLegalAction(row.chosenBestAction, row.legalActions ?? [])) reasons.push("chosenBestIllegal");

  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export async function loadActionValueDataset(datasetPath, options = {}) {
  const {
    allowInvalidRows = false,
  } = options;
  const warnings = [];
  const errors = [];
  const rows = [];
  const validRows = [];
  const invalidRows = [];
  const seen = new Set();
  const variantDistribution = new Map();
  const bucketDistribution = new Map();
  const actionDistribution = new Map();
  const confidenceDistribution = new Map();

  let content = "";
  try {
    content = await fs.readFile(datasetPath, "utf8");
  } catch (error) {
    return {
      rows,
      validRows,
      invalidRows,
      summary: {
        datasetPath,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        variantDistribution: {},
        bucketDistribution: {},
        actionDistribution: {},
        confidenceDistribution: {},
        trainingAllowed: false,
      },
      warnings,
      errors: [`dataset-read-failed:${error.message}`],
    };
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    let parsed = null;
    try {
      parsed = JSON.parse(lines[index]);
      parsed = normalizeLegacyRow(parsed);
      rows.push(parsed);
    } catch (error) {
      invalidRows.push({
        index,
        row: null,
        reasons: [`json-parse:${error.message}`],
      });
      errors.push(`row-${index + 1}-json-parse`);
      continue;
    }

    const duplicateKey = [
      parsed.variantId,
      parsed.metadata?.seed,
      parsed.metadata?.handId,
      parsed.metadata?.step,
      parsed.metadata?.actorSeat,
      parsed.bucket,
      actionType(parsed.chosenBestAction),
    ].join("|");
    const validation = validateActionValueRow(parsed);
    const reasons = [...validation.reasons];
    if (seen.has(duplicateKey)) reasons.push("duplicate");
    else seen.add(duplicateKey);

    if (reasons.length) {
      invalidRows.push({ index, row: parsed, reasons: [...new Set(reasons)] });
      if (!allowInvalidRows) continue;
    } else {
      validRows.push(parsed);
      incrementDistribution(variantDistribution, parsed.variantId);
      incrementDistribution(bucketDistribution, parsed.bucket);
      incrementDistribution(actionDistribution, actionType(parsed.chosenBestAction));
      (parsed.candidateActions ?? []).forEach((candidate) => {
        incrementDistribution(confidenceDistribution, bucketConfidenceBand(candidate.confidence));
      });
    }
  }

  if (validRows.length < 100) warnings.push("sparse-dataset");
  if (variantDistribution.size < 3) warnings.push("low-variant-coverage");
  if ([...variantDistribution.keys()].length === 1) warnings.push("single-variant-bias");
  if ((variantDistribution.get("D02") ?? 0) / Math.max(1, validRows.length) > 0.7) warnings.push("d02-heavy-bias");

  const summary = {
    datasetPath,
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    variantDistribution: Object.fromEntries(variantDistribution),
    bucketDistribution: Object.fromEntries(bucketDistribution),
    actionDistribution: Object.fromEntries(actionDistribution),
    confidenceDistribution: Object.fromEntries(confidenceDistribution),
    trainingAllowed: rows.length > 0 && invalidRows.length === 0,
  };

  return {
    rows,
    validRows,
    invalidRows,
    summary,
    warnings,
    errors,
  };
}
