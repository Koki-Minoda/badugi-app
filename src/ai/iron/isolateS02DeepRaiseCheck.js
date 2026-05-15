import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { average, entropyFromCounts, signFlipRate } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP36_DEEP_RAISECHECK_ISOLATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-raisecheck-isolation-step36.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);
export const STEP36_ISOLATION_AXES = ["handClass", "position", "pressureFamily", "drawRound", "playerCount", "callBand"];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function selectedResults(report = {}) {
  return (report.depths ?? [])
    .filter((depth) => depth.stackDepth === "deep")
    .flatMap((depth) => depth.results ?? [])
    .filter((result) => result.valid && result.forcedA === "RAISE" && result.forcedB === "CHECK");
}

function confidenceFor(rows = [], flip = 0) {
  return roundNumber(Math.min(0.95, (rows.filter((row) => row.valid).length / 40) * (1 - flip)), 4);
}

function signEntropy(deltas = []) {
  const counts = {
    positive: deltas.filter((delta) => delta > 0).length,
    negative: deltas.filter((delta) => delta < 0).length,
  };
  return entropyFromCounts(counts);
}

function median(values = []) {
  const list = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!list.length) return 0;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function classify(row = {}) {
  if (Number(row.sampleCount ?? 0) === 0) return "NO_SIGNAL";
  if (Number(row.invalidReplayCount ?? 0) > 0) return "COUNTERFACTUAL_ONLY";
  if (
    Number(row.sampleCount ?? 0) >= 20 &&
    Number(row.signFlipRate ?? 0) <= 0.1 &&
    Number(row.confidence ?? 0) >= 0.8 &&
    Number(row.repairRate ?? 0) <= 0.1 &&
    Number(row.entropyScore ?? 0) <= 0.75 &&
    Number(row.meanDelta ?? 0) > 0
  ) {
    return "STABLE";
  }
  if (Number(row.meanDelta ?? 0) > 0 && Number(row.signFlipRate ?? 0) <= 0.1) return "UNDERPOWERED";
  return "VOLATILE";
}

function summarize(bucket, rows = [], axis = "overall") {
  const valid = rows.filter((row) => row.valid);
  const deltas = valid.map((row) => Number(row.delta ?? 0)).filter(Number.isFinite);
  const flip = signFlipRate(deltas);
  const repairRate = rows.length ? rows.filter((row) => row.repairUsed).length / rows.length : 0;
  const summary = {
    axis,
    bucket,
    sampleCount: rows.length,
    validReplayCount: valid.length,
    invalidReplayCount: rows.length - valid.length,
    meanDelta: roundNumber(average(deltas), 4),
    medianDelta: roundNumber(median(deltas), 4),
    signFlipRate: flip,
    confidence: confidenceFor(rows, flip),
    repairRate: roundNumber(repairRate, 4),
    entropyScore: signEntropy(deltas),
    positive: deltas.filter((delta) => delta > 0).length,
    negative: deltas.filter((delta) => delta < 0).length,
    tie: deltas.filter((delta) => delta === 0).length,
  };
  return { ...summary, verdict: classify(summary) };
}

export function isolateS02DeepRaiseCheck({
  forcedReplayReport = {},
  axes = STEP36_ISOLATION_AXES,
  outputPath = DEFAULT_STEP36_DEEP_RAISECHECK_ISOLATION_OUTPUT_PATH,
} = {}) {
  const results = selectedResults(forcedReplayReport);
  const rows = [summarize("deep RAISE vs CHECK", results, "overall")];
  for (const axis of axes) {
    const groups = new Map();
    results.forEach((result) => {
      const bucket = String(result.sampleMeta?.[axis] ?? "unknown");
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(result);
    });
    for (const [bucket, entries] of groups.entries()) {
      rows.push(summarize(`${axis}=${bucket}`, entries, axis));
    }
  }
  rows.sort((left, right) => {
    if (left.axis === "overall") return -1;
    if (right.axis === "overall") return 1;
    return left.axis.localeCompare(right.axis) || right.sampleCount - left.sampleCount || left.bucket.localeCompare(right.bucket);
  });
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK",
    rows,
    stableRows: rows.filter((row) => row.verdict === "STABLE").length,
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

export async function writeS02DeepRaiseCheckIsolation({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP36_DEEP_RAISECHECK_ISOLATION_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, isolateS02DeepRaiseCheck({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepRaiseCheckIsolation();
  console.log(JSON.stringify(report, null, 2));
}
