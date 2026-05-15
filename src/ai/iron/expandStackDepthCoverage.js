import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import {
  DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  STEP32_STACK_DEPTHS,
  generateCoverageTargetedReplayCorpus,
} from "./generateCoverageTargetedReplayCorpus.js";

export const DEFAULT_STEP32_STACK_DEPTH_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/stackdepth-diversity-step32.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function expandStackDepthCoverage({ samples = [] } = {}) {
  const selected = samples.filter((sample) => STEP32_STACK_DEPTHS.includes(sample.stackDepth));
  const unique = Array.from(new Set(selected.map((sample) => sample.stackDepth))).sort();
  const coverage = roundNumber(unique.length / STEP32_STACK_DEPTHS.length, 4);
  return {
    generatedAt: new Date().toISOString(),
    dimension: "stackDepth",
    targetCoverage: 0.5,
    achievedCoverage: coverage,
    passedTarget: coverage > 0.5,
    classes: STEP32_STACK_DEPTHS,
    unique,
    addedSamples: selected.length,
    samples: selected,
    deterministicReplay: selected.every((sample) => sample.deterministicReplay === true),
    invalidReplayCount: selected.reduce((sum, sample) => sum + Number(sample.invalidReplayCount ?? 0), 0),
    illegal: selected.reduce((sum, sample) => sum + Number(sample.illegal ?? 0), 0),
    freeze: selected.reduce((sum, sample) => sum + Number(sample.freeze ?? 0), 0),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP32_STACK_DEPTH_OUTPUT_PATH,
  };
}

export async function writeStackDepthCoverage({
  corpusPath = DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  outputPath = DEFAULT_STEP32_STACK_DEPTH_OUTPUT_PATH,
  samples,
} = {}) {
  const corpus = samples ? { samples } : (await readJsonIfExists(corpusPath)) ?? generateCoverageTargetedReplayCorpus();
  return writeJsonReport(outputPath, expandStackDepthCoverage({ samples: corpus.samples ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeStackDepthCoverage();
  console.log(JSON.stringify(report, null, 2));
}
