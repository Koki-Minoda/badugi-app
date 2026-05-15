import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { average, signFlipRate } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP35_MEDIUM_SIGNFLIP_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-medium-signflip-isolation-step35.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function classifyFlip(rate) {
  if (rate <= 0.1) return "LOW_FLIP";
  if (rate <= 0.2) return "MIXED";
  return "HIGH_FLIP";
}

function axisValue(result = {}, axis = "") {
  const meta = result.sampleMeta ?? {};
  if (axis === "actionPair") return `${result.forcedA} vs ${result.forcedB}`;
  return meta[axis] ?? "unknown";
}

function summarizeRows(rows = []) {
  const valid = rows.filter((row) => row.valid);
  const deltas = valid.map((row) => Number(row.delta ?? 0)).filter(Number.isFinite);
  const flip = signFlipRate(deltas);
  return {
    sample: rows.length,
    valid: valid.length,
    invalid: rows.length - valid.length,
    meanDelta: roundNumber(average(deltas), 4),
    signFlipRate: flip,
    confidence: roundNumber(Math.min(0.95, (valid.length / 40) * (1 - flip)), 4),
    positive: deltas.filter((delta) => delta > 0).length,
    negative: deltas.filter((delta) => delta < 0).length,
    verdict: classifyFlip(flip),
  };
}

export function isolateS02MediumSignFlip({
  forcedReplayReport = {},
  axes = ["actionPair", "pressureFamily", "playerCount", "callBand", "drawRound", "position"],
  outputPath = DEFAULT_STEP35_MEDIUM_SIGNFLIP_OUTPUT_PATH,
} = {}) {
  const medium = (forcedReplayReport.depths ?? []).find((depth) => depth.stackDepth === "medium");
  const mediumResults = medium?.results ?? [];
  const rows = [];
  for (const axis of axes) {
    const groups = new Map();
    mediumResults.forEach((result) => {
      const key = String(axisValue(result, axis));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(result);
    });
    for (const [bucket, entries] of groups.entries()) {
      rows.push({ axis, bucket, ...summarizeRows(entries) });
    }
  }
  rows.sort((left, right) => right.signFlipRate - left.signFlipRate || right.sample - left.sample || left.axis.localeCompare(right.axis));
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    depth: "medium",
    sampleCount: mediumResults.length,
    overall: summarizeRows(mediumResults),
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

export async function writeS02MediumSignFlipIsolation({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP35_MEDIUM_SIGNFLIP_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, isolateS02MediumSignFlip({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02MediumSignFlipIsolation();
  console.log(JSON.stringify(report, null, 2));
}
