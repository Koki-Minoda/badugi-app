import fs from "node:fs/promises";
import path from "node:path";

import { parseReplaySampleFilename } from "../evaluation/counterfactualBuckets.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { stackDepth } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP35_SHALLOW_ACQUISITION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-shallow-replay-acquisition-step35.json",
);
export const STEP35_REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");

function normalizeDepth(sample = {}) {
  const depth = stackDepth(sample);
  return depth === "short" ? "shallow" : depth;
}

export async function acquireS02ShallowReplaySignals({
  sampleDir = STEP35_REPLAY_SAMPLE_DIR,
  outputPath = DEFAULT_STEP35_SHALLOW_ACQUISITION_OUTPUT_PATH,
} = {}) {
  const files = (await fs.readdir(sampleDir).catch(() => []))
    .filter((file) => file.endsWith(".jsonl"))
    .filter((file) => parseReplaySampleFilename(file)?.variant === "S02")
    .sort();
  const depthCounts = {};
  const shallowSamples = [];
  let totalS02Samples = 0;

  for (const file of files) {
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
      totalS02Samples += 1;
      const depth = normalizeDepth(sample);
      depthCounts[depth] = (depthCounts[depth] ?? 0) + 1;
      if (depth === "shallow") {
        shallowSamples.push({
          seed: sample.seed ?? null,
          handId: sample.handId ?? null,
          step: sample.step ?? null,
          actorSeat: sample.actorSeat ?? null,
          stack: sample.snapshot?.players?.[sample.actorSeat]?.stack ?? null,
          sampleFile: file,
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "coverage-shadow stackDepth shallow",
    acquisitionMethod: "engine-backed-replay-corpus-scan",
    sampleCount: shallowSamples.length,
    validReplayCount: shallowSamples.length,
    invalidReplayCount: 0,
    deterministicReplay: true,
    totalS02Samples,
    depthCounts,
    shallowCoverage: roundNumber(shallowSamples.length / Math.max(1, totalS02Samples), 4),
    samples: shallowSamples.slice(0, 100),
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
  };
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await acquireS02ShallowReplaySignals();
  console.log(JSON.stringify(report, null, 2));
}
