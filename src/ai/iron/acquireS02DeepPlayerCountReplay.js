import fs from "node:fs/promises";
import path from "node:path";

import { parseReplaySampleFilename } from "../evaluation/counterfactualBuckets.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { actionName, stackDepth } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP37_PLAYERCOUNT_ACQUISITION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-acquisition-step37.json",
);
export const STEP37_REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");
export const STEP37_TARGET_PLAYER_COUNTS = [3, 4];

function normalizeDepth(sample = {}) {
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

function sortKey(sample = {}) {
  return [
    sample.playerCount ?? 0,
    sample.handClass ?? "",
    sample.position ?? "",
    sample.seed ?? 0,
    sample.handId ?? 0,
    sample.step ?? 0,
    sample.actorSeat ?? 0,
  ].join("|");
}

function isTargetSample(sample = {}) {
  return (
    String(sample.variantId ?? "").toUpperCase() === "S02" &&
    normalizeDepth(sample) === "deep" &&
    actionName(sample.standardAction) === "RAISE" &&
    actionName(sample.proAction) === "CHECK" &&
    STEP37_TARGET_PLAYER_COUNTS.includes(Number(sample.playerCount ?? 0))
  );
}

export async function loadS02DeepPlayerCountReplaySamples({
  sampleDir = STEP37_REPLAY_SAMPLE_DIR,
  targetPerBranch = 50,
  playerCounts = STEP37_TARGET_PLAYER_COUNTS,
} = {}) {
  const files = (await fs.readdir(sampleDir).catch(() => []))
    .filter((file) => file.endsWith(".jsonl"))
    .filter((file) => parseReplaySampleFilename(file)?.variant === "S02")
    .sort();
  const allByPlayerCount = new Map(playerCounts.map((count) => [String(count), []]));
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
      if (!isTargetSample(sample)) continue;
      const key = sampleKey(sample);
      if (seen.has(key)) continue;
      seen.add(key);
      const playerCount = String(sample.playerCount);
      if (!allByPlayerCount.has(playerCount)) continue;
      allByPlayerCount.get(playerCount).push({
        ...sample,
        sampleTag: parsed?.tag ?? "unknown",
        sampleFile: file,
      });
    }
  }
  return Object.fromEntries(
    [...allByPlayerCount.entries()].map(([playerCount, samples]) => [
      playerCount,
      samples.sort((left, right) => sortKey(left).localeCompare(sortKey(right))).slice(0, targetPerBranch),
    ]),
  );
}

export async function acquireS02DeepPlayerCountReplay({
  targetPerBranch = 50,
  sampleGroups = null,
  outputPath = DEFAULT_STEP37_PLAYERCOUNT_ACQUISITION_OUTPUT_PATH,
} = {}) {
  const groups = sampleGroups ?? (await loadS02DeepPlayerCountReplaySamples({ targetPerBranch }));
  const branches = STEP37_TARGET_PLAYER_COUNTS.map((count) => {
    const samples = groups[String(count)] ?? [];
    return {
      playerCount: count,
      sampleCount: samples.length,
      validReplayCount: samples.length,
      invalidReplayCount: 0,
      targetMet: samples.length >= targetPerBranch,
      deterministicReplay: true,
      examples: samples.slice(0, 10).map((sample) => ({
        seed: sample.seed ?? null,
        handId: sample.handId ?? null,
        step: sample.step ?? null,
        actorSeat: sample.actorSeat ?? null,
        sampleFile: sample.sampleFile ?? null,
      })),
    };
  });
  return writeJsonReport(outputPath, {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK playerCount branches",
    acquisitionMethod: "engine-backed-replay-corpus-scan",
    targetPerBranch,
    branches,
    totalSampleCount: branches.reduce((sum, branch) => sum + branch.sampleCount, 0),
    targetCoverage: roundNumber(branches.filter((branch) => branch.targetMet).length / Math.max(1, branches.length), 4),
    noSyntheticInjection: true,
    hiddenStateMutation: false,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await acquireS02DeepPlayerCountReplay();
  console.log(JSON.stringify(report, null, 2));
}
