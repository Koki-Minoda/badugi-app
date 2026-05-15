import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { entropyFromCounts } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP36_DEEP_ENTROPY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-entropy-step36.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

const SOURCES = [
  ["position", "position entropy"],
  ["pressureFamily", "pressure entropy"],
  ["drawRound", "drawRound entropy"],
  ["playerCount", "playerCount entropy"],
  ["callBand", "callBand entropy"],
];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function severity(entropy) {
  if (entropy <= 0.1) return "LOW_ENTROPY";
  if (entropy <= 0.75) return "MIXED";
  return "HIGH_ENTROPY";
}

function targetResults(report = {}) {
  return (report.depths ?? [])
    .filter((depth) => depth.stackDepth === "deep")
    .flatMap((depth) => depth.results ?? [])
    .filter((result) => result.valid && result.forcedA === "RAISE" && result.forcedB === "CHECK");
}

export function auditS02DeepEntropySources({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP36_DEEP_ENTROPY_OUTPUT_PATH,
} = {}) {
  const results = targetResults(forcedReplayReport);
  const rows = SOURCES.map(([field, label]) => {
    const counts = results.reduce((accumulator, result) => {
      const value = String(result.sampleMeta?.[field] ?? "unknown");
      accumulator[value] = (accumulator[value] ?? 0) + 1;
      return accumulator;
    }, {});
    const entropy = entropyFromCounts(counts);
    return {
      source: label,
      field,
      sampleCount: results.length,
      unique: Object.keys(counts).length,
      counts,
      entropy: roundNumber(entropy, 4),
      severity: severity(entropy),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK",
    rows,
    maxEntropy: roundNumber(Math.max(0, ...rows.map((row) => row.entropy)), 4),
    classification: rows.some((row) => row.severity === "HIGH_ENTROPY")
      ? "HIGH_ENTROPY"
      : rows.some((row) => row.severity === "MIXED")
        ? "MIXED"
        : "LOW_ENTROPY",
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

export async function writeS02DeepEntropyAudit({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP36_DEEP_ENTROPY_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, auditS02DeepEntropySources({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepEntropyAudit();
  console.log(JSON.stringify(report, null, 2));
}
