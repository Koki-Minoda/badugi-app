import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { average, entropyFromCounts, signFlipRate } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP35_ACTIONPAIR_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-actionpair-isolation-step35.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function summarizePair(pair, rows = []) {
  const valid = rows.filter((row) => row.valid);
  const deltas = valid.map((row) => Number(row.delta ?? 0)).filter(Number.isFinite);
  const flip = signFlipRate(deltas);
  const directionCounts = {
    positive: deltas.filter((delta) => delta > 0).length,
    negative: deltas.filter((delta) => delta < 0).length,
    tie: deltas.filter((delta) => delta === 0).length,
  };
  const depthCounts = rows.reduce((counts, row) => {
    const depth = row.sampleMeta?.stackDepth ?? "unknown";
    counts[depth] = (counts[depth] ?? 0) + 1;
    return counts;
  }, {});
  return {
    pair,
    sample: rows.length,
    valid: valid.length,
    invalid: rows.length - valid.length,
    meanDelta: roundNumber(average(deltas), 4),
    signFlipRate: flip,
    confidence: roundNumber(Math.min(0.95, (valid.length / 40) * (1 - flip)), 4),
    entropy: entropyFromCounts(directionCounts),
    directionCounts,
    depthCounts,
  };
}

export function isolateS02ActionPairs({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP35_ACTIONPAIR_OUTPUT_PATH,
} = {}) {
  const results = (forcedReplayReport.depths ?? []).flatMap((depth) => depth.results ?? []);
  const groups = new Map();
  results.forEach((result) => {
    const pair = `${result.forcedA} vs ${result.forcedB}`;
    if (!groups.has(pair)) groups.set(pair, []);
    groups.get(pair).push(result);
  });
  const pairs = [...groups.entries()]
    .map(([pair, rows]) => summarizePair(pair, rows))
    .sort((left, right) => right.sample - left.sample || left.pair.localeCompare(right.pair));
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    pairs,
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

export async function writeS02ActionPairIsolation({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP35_ACTIONPAIR_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, isolateS02ActionPairs({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02ActionPairIsolation();
  console.log(JSON.stringify(report, null, 2));
}
