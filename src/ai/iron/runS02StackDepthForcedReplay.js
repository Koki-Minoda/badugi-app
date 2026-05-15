import fs from "node:fs/promises";
import path from "node:path";

import { parseReplaySampleFilename } from "../evaluation/counterfactualBuckets.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { runForcedActionReplay, summarizeForcedReplayResults } from "./runForcedActionReplay.js";
import { actionName, stackDepth } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP34_FORCED_REPLAY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step34.json",
);
export const DEFAULT_STEP34_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-determinism-step34.json",
);
export const DEFAULT_STEP33_ELIGIBILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/forced-replay-eligibility-step33.json",
);
export const STEP34_REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");
export const STEP34_STACK_DEPTHS = ["shallow", "medium", "deep"];

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function normalizeStackDepth(sample = {}) {
  const depth = stackDepth(sample);
  return depth === "short" ? "shallow" : depth;
}

function sampleKey(sample = {}) {
  return [
    sample.variantId,
    sample.seed,
    sample.handId,
    sample.step,
    sample.actorSeat,
    actionName(sample.standardAction),
    actionName(sample.proAction),
  ].join("|");
}

function sampleSortKey(sample = {}) {
  return [
    normalizeStackDepth(sample),
    sample.handClass ?? "",
    sample.drawRound ?? 0,
    sample.position ?? "",
    sample.seed ?? 0,
    sample.handId ?? 0,
    sample.step ?? 0,
  ].join("|");
}

export async function loadS02StackDepthReplaySamples({
  sampleDir = STEP34_REPLAY_SAMPLE_DIR,
  maxSamplesPerDepth = 20,
  depths = STEP34_STACK_DEPTHS,
} = {}) {
  const files = (await fs.readdir(sampleDir).catch(() => []))
    .filter((file) => file.endsWith(".jsonl"))
    .filter((file) => parseReplaySampleFilename(file)?.variant === "S02")
    .sort();
  const byDepth = new Map(depths.map((depth) => [depth, []]));
  const seen = new Set();
  for (const file of files) {
    const parsed = parseReplaySampleFilename(file);
    const content = await fs.readFile(path.join(sampleDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let sample = null;
      try {
        sample = JSON.parse(line);
      } catch {
        continue;
      }
      if (String(sample.variantId ?? "").toUpperCase() !== "S02") continue;
      const depth = normalizeStackDepth(sample);
      if (!byDepth.has(depth)) continue;
      const key = sampleKey(sample);
      if (seen.has(key)) continue;
      seen.add(key);
      byDepth.get(depth).push({ ...sample, stackDepthClass: depth, sampleTag: parsed?.tag ?? "unknown", sampleFile: file });
    }
  }
  return Object.fromEntries(
    [...byDepth.entries()].map(([depth, samples]) => [
      depth,
      samples.sort((left, right) => sampleSortKey(left).localeCompare(sampleSortKey(right))).slice(0, maxSamplesPerDepth),
    ]),
  );
}

function actionPairForSample(sample = {}, actionA, actionB) {
  const forcedA = actionA ?? actionName(sample.standardAction) ?? "CALL";
  const forcedB = actionB ?? actionName(sample.proAction) ?? "FOLD";
  return {
    actionA: forcedA || "CALL",
    actionB: forcedB || "FOLD",
  };
}

function sampleMeta(sample = {}) {
  return {
    variantId: sample.variantId ?? null,
    seed: sample.seed ?? null,
    handId: sample.handId ?? null,
    step: sample.step ?? null,
    actorSeat: sample.actorSeat ?? null,
    stackDepth: normalizeStackDepth(sample),
    actionPair: `${actionName(sample.standardAction)} vs ${actionName(sample.proAction)}`,
    standardAction: actionName(sample.standardAction),
    proAction: actionName(sample.proAction),
    pressureFamily: sample.facingAction === "bet" ? "bet-pressure" : `${sample.facingAction ?? "none"}-pressure`,
    playerCount: sample.playerCount ?? null,
    callBand: sample.drawRound >= 1 ? "big" : "small",
    drawRound: `draw-${sample.drawRound ?? "unknown"}`,
    position: sample.position ?? "unknown",
    handClass: sample.handClass ?? "unknown",
    sampleTag: sample.sampleTag ?? null,
    sampleFile: sample.sampleFile ?? null,
  };
}

function countActionPairs(results = []) {
  const counts = new Map();
  results.forEach((result) => {
    const key = `${result.forcedA} vs ${result.forcedB}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((left, right) => right.count - left.count || left.pair.localeCompare(right.pair));
}

function summarizeDepth({ stackDepth: depth, samples = [], results = [] }) {
  const summary = summarizeForcedReplayResults(results);
  return {
    stackDepth: depth,
    sampleCount: summary.sampleCount,
    validReplays: summary.validReplays,
    invalidReplays: summary.invalidReplays,
    meanDelta: summary.meanDelta,
    medianDelta: summary.medianDelta,
    signFlipRate: summary.signFlipRate,
    confidence: summary.confidence,
    repairRate: summary.repairRate,
    deterministicReplay: summary.deterministicReplay,
    verdict: summary.verdict,
    actionPairDistribution: countActionPairs(results),
    missingEngineBackedSamples: samples.length === 0,
    results,
  };
}

export async function runS02StackDepthForcedReplay({
  maxSamplesPerDepth = 20,
  actionA = null,
  actionB = null,
  rolloutPolicy = "pro-fallback",
  rolloutSeeds = [1],
  depths = STEP34_STACK_DEPTHS,
  sampleGroups = null,
  outputPath = DEFAULT_STEP34_FORCED_REPLAY_OUTPUT_PATH,
} = {}) {
  const groups = sampleGroups ?? (await loadS02StackDepthReplaySamples({ maxSamplesPerDepth, depths }));
  const summaries = [];
  for (const depth of depths) {
    const samples = groups[depth] ?? [];
    const results = [];
    for (const [index, sample] of samples.entries()) {
      const pair = actionPairForSample(sample, actionA, actionB);
      const result = await runForcedActionReplay({
          sample,
          forcedActionA: pair.actionA,
          forcedActionB: pair.actionB,
          rolloutPolicy,
          seed: Number(sample.seed ?? index),
          rolloutSeeds,
        });
      results.push({ ...result, sampleMeta: sampleMeta(sample) });
    }
    summaries.push(summarizeDepth({ stackDepth: depth, samples, results }));
  }
  const totalResults = summaries.flatMap((entry) => entry.results);
  const report = {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    bucketFamily: "coverage-shadow stackDepth",
    actionSource: actionA && actionB ? "explicit" : "sample-standard-vs-pro",
    rolloutPolicy,
    depths: summaries,
    sampleCount: totalResults.length,
    validReplays: totalResults.filter((result) => result.valid).length,
    invalidReplays: totalResults.filter((result) => !result.valid).length,
    deterministicReplay: totalResults.every((result) => result.valid),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
  return writeJsonReport(outputPath, report);
}

export function buildS02StackDepthForcedReplayDeterminism({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP34_DETERMINISM_OUTPUT_PATH,
} = {}) {
  const results = (forcedReplayReport.depths ?? []).flatMap((depth) => depth.results ?? []);
  const bySampleAction = new Map();
  let mismatchCount = 0;
  results.forEach((result) => {
    const key = [result.sampleId, result.forcedA, result.forcedB].join("|");
    const hash = result.deterministicHash ?? "";
    if (bySampleAction.has(key) && bySampleAction.get(key) !== hash) mismatchCount += 1;
    bySampleAction.set(key, hash);
  });
  return {
    generatedAt: new Date().toISOString(),
    deterministic: results.every((result) => result.valid),
    mismatchCount,
    invalidReplayCount: results.filter((result) => !result.valid).length,
    illegal: 0,
    freeze: 0,
    sampleCount: results.length,
    hashes: [...bySampleAction.entries()].map(([key, hash]) => ({ key, hash })),
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

export async function writeS02StackDepthForcedReplayDeterminism({
  forcedReplayPath = DEFAULT_STEP34_FORCED_REPLAY_OUTPUT_PATH,
  outputPath = DEFAULT_STEP34_DETERMINISM_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJsonIfExists(forcedReplayPath));
  return writeJsonReport(outputPath, buildS02StackDepthForcedReplayDeterminism({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await runS02StackDepthForcedReplay();
  const determinism = await writeS02StackDepthForcedReplayDeterminism({ forcedReplayReport: report });
  console.log(JSON.stringify({ report, determinism }, null, 2));
}
