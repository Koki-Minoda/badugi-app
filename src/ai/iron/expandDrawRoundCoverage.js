import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import {
  DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  STEP32_DRAW_ROUNDS,
  generateCoverageTargetedReplayCorpus,
} from "./generateCoverageTargetedReplayCorpus.js";

export const DEFAULT_STEP32_DRAW_ROUND_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/drawround-diversity-step32.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function expandDrawRoundCoverage({ samples = [] } = {}) {
  const selected = samples.filter((sample) => STEP32_DRAW_ROUNDS.includes(sample.drawRound));
  const unique = Array.from(new Set(selected.map((sample) => sample.drawRound))).sort();
  const coverage = roundNumber(unique.length / STEP32_DRAW_ROUNDS.length, 4);
  return {
    generatedAt: new Date().toISOString(),
    dimension: "drawRound",
    targetCoverage: 0.75,
    achievedCoverage: coverage,
    passedTarget: coverage > 0.75,
    classes: STEP32_DRAW_ROUNDS,
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
    outputPath: DEFAULT_STEP32_DRAW_ROUND_OUTPUT_PATH,
  };
}

export async function writeDrawRoundCoverage({
  corpusPath = DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  outputPath = DEFAULT_STEP32_DRAW_ROUND_OUTPUT_PATH,
  samples,
} = {}) {
  const corpus = samples ? { samples } : (await readJsonIfExists(corpusPath)) ?? generateCoverageTargetedReplayCorpus();
  return writeJsonReport(outputPath, expandDrawRoundCoverage({ samples: corpus.samples ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeDrawRoundCoverage();
  console.log(JSON.stringify(report, null, 2));
}
