import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP36_CROSSBUCKET_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-crossbucket-stability-step36.json",
);
export const DEFAULT_STEP36_NARROW_CANDIDATES_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-narrow-candidates-step36.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function direction(candidate = {}) {
  if (Number(candidate.meanDelta ?? 0) > 0) return "POSITIVE";
  if (Number(candidate.meanDelta ?? 0) < 0) return "NEGATIVE";
  return "FLAT";
}

function classify(rows = []) {
  if (!rows.length) return "PARTIAL";
  const directions = new Set(rows.map(direction));
  if (directions.has("POSITIVE") && directions.size === 1) return "CONSISTENT";
  if (directions.has("POSITIVE")) return "PARTIAL";
  return "INCONSISTENT";
}

export function auditS02DeepCrossBucketStability({
  candidateReport = {},
  outputPath = DEFAULT_STEP36_CROSSBUCKET_OUTPUT_PATH,
} = {}) {
  const eligible = (candidateReport.candidates ?? []).filter((candidate) =>
    ["EXPORTABLE_CANDIDATE", "COUNTERFACTUAL_ONLY"].includes(candidate.verdict),
  );
  const rows = eligible.map((candidate) => ({
    candidate: candidate.candidate,
    axis: candidate.axis,
    sample: candidate.sample,
    meanDelta: candidate.meanDelta,
    signFlipRate: candidate.signFlipRate,
    confidence: candidate.confidence,
    entropy: candidate.entropy,
    verdict: candidate.verdict,
    direction: direction(candidate),
  }));
  const consistency = classify(rows);
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK",
    consistency,
    directionConsistent: consistency === "CONSISTENT",
    rows,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeS02DeepCrossBucketStability({
  candidatePath = DEFAULT_STEP36_NARROW_CANDIDATES_INPUT_PATH,
  outputPath = DEFAULT_STEP36_CROSSBUCKET_OUTPUT_PATH,
  candidateReport,
} = {}) {
  const report = candidateReport ?? (await readJson(candidatePath));
  return writeJsonReport(outputPath, auditS02DeepCrossBucketStability({ candidateReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepCrossBucketStability();
  console.log(JSON.stringify(report, null, 2));
}
