import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import {
  DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  STEP32_PLAYER_COUNTS,
  generateCoverageTargetedReplayCorpus,
} from "./generateCoverageTargetedReplayCorpus.js";

export const DEFAULT_STEP32_PLAYER_COUNT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/playercount-diversity-step32.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function normalizePlayerCount(value) {
  return value === "heads-up" ? "HU" : value;
}

export function expandPlayerCountCoverage({ samples = [] } = {}) {
  const selected = samples
    .map((sample) => ({ ...sample, playerCount: normalizePlayerCount(sample.playerCount) }))
    .filter((sample) => STEP32_PLAYER_COUNTS.includes(sample.playerCount));
  const unique = Array.from(new Set(selected.map((sample) => sample.playerCount))).sort();
  const coverage = roundNumber(unique.length / STEP32_PLAYER_COUNTS.length, 4);
  return {
    generatedAt: new Date().toISOString(),
    dimension: "playerCount",
    targetCoverage: 0.9,
    achievedCoverage: coverage,
    passedTarget: coverage > 0.9,
    classes: STEP32_PLAYER_COUNTS,
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
    outputPath: DEFAULT_STEP32_PLAYER_COUNT_OUTPUT_PATH,
  };
}

export async function writePlayerCountCoverage({
  corpusPath = DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  outputPath = DEFAULT_STEP32_PLAYER_COUNT_OUTPUT_PATH,
  samples,
} = {}) {
  const corpus = samples ? { samples } : (await readJsonIfExists(corpusPath)) ?? generateCoverageTargetedReplayCorpus();
  return writeJsonReport(outputPath, expandPlayerCountCoverage({ samples: corpus.samples ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writePlayerCountCoverage();
  console.log(JSON.stringify(report, null, 2));
}
