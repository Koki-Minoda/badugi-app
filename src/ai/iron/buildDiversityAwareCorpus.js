import fs from "node:fs/promises";
import path from "node:path";

import { auditReplayDiversity } from "./auditReplayDiversity.js";
import { buildFutureCandidateQueue } from "./buildFutureCandidateQueue.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import {
  DEFAULT_STEP32_DRAW_ROUND_OUTPUT_PATH,
  expandDrawRoundCoverage,
} from "./expandDrawRoundCoverage.js";
import {
  DEFAULT_STEP32_PLAYER_COUNT_OUTPUT_PATH,
  expandPlayerCountCoverage,
} from "./expandPlayerCountCoverage.js";
import {
  DEFAULT_STEP32_STACK_DEPTH_OUTPUT_PATH,
  expandStackDepthCoverage,
} from "./expandStackDepthCoverage.js";
import { generateCoverageTargetedReplayCorpus } from "./generateCoverageTargetedReplayCorpus.js";
import { mineEntropyAwareCandidates } from "./mineEntropyAwareCandidates.js";
import { scoreCandidateRarity } from "./scoreCandidateRarity.js";

export const DEFAULT_STEP32_DIVERSITY_CORPUS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/diversity-aware-corpus-step32.json",
);
export const DEFAULT_STEP32_REPLAY_DIVERSITY_RERUN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/replay-diversity-rerun-step32.json",
);
export const DEFAULT_STEP32_ENTROPY_RERUN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/entropy-aware-candidates-rerun-step32.json",
);
export const DEFAULT_STEP32_RARITY_RERUN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/candidate-rarity-rerun-step32.json",
);
export const DEFAULT_STEP32_QUEUE_RERUN_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/future-candidate-queue-rerun-step32.json",
);
const DEFAULT_STEP31_ENTROPY_INPUT_PATH = path.resolve("reports/ai-iron/entropy-aware-candidates-step31.json");
const DEFAULT_STEP31_REJECTION_INPUT_PATH = path.resolve("reports/ai-iron/weak-trash-rejection-step31.json");

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function sampleIsClean(sample = {}) {
  return (
    sample.deterministicReplay === true &&
    Number(sample.invalidReplayCount ?? 0) === 0 &&
    Number(sample.illegal ?? 0) === 0 &&
    Number(sample.freeze ?? 0) === 0
  );
}

function mergeSamples(reports = []) {
  const map = new Map();
  reports.flatMap((report) => report?.samples ?? []).forEach((sample) => {
    if (!sampleIsClean(sample)) return;
    map.set(sample.sampleId, sample);
  });
  return [...map.values()];
}

function countBy(samples = [], key) {
  const map = new Map();
  samples.forEach((sample) => map.set(sample[key], (map.get(sample[key]) ?? 0) + 1));
  return [...map.entries()].map(([value, count]) => ({ value, count }));
}

export function buildCoverageShadowCandidates(samples = []) {
  return countBy(samples, "stackDepth").map(({ value, count }) => ({
    variant: "S02",
    bucket: `coverage-shadow stackDepth ${value}`,
    frequency: count,
    confidence: roundNumber(Math.min(0.75, count / 40), 4),
    standardAdvantage: 0,
    signFlipRate: 0,
    repairRate: 0,
    invalidReplayCount: 0,
    entropyScore: 0.45,
  }));
}

export function buildDiversityAwareCorpus({ stackDepthReport, drawRoundReport, playerCountReport } = {}) {
  const fallbackCorpus = generateCoverageTargetedReplayCorpus();
  const stack = stackDepthReport ?? expandStackDepthCoverage({ samples: fallbackCorpus.samples });
  const draw = drawRoundReport ?? expandDrawRoundCoverage({ samples: fallbackCorpus.samples });
  const player = playerCountReport ?? expandPlayerCountCoverage({ samples: fallbackCorpus.samples });
  const samples = mergeSamples([stack, draw, player]);
  return {
    generatedAt: new Date().toISOString(),
    samples,
    sampleCount: samples.length,
    deterministicReplay: samples.every((sample) => sample.deterministicReplay === true),
    invalidReplayCount: samples.reduce((sum, sample) => sum + Number(sample.invalidReplayCount ?? 0), 0),
    illegal: samples.reduce((sum, sample) => sum + Number(sample.illegal ?? 0), 0),
    freeze: samples.reduce((sum, sample) => sum + Number(sample.freeze ?? 0), 0),
    entropyMetadataPreserved: samples.every((sample) => Number.isFinite(Number(sample.entropyScore))),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP32_DIVERSITY_CORPUS_OUTPUT_PATH,
  };
}

export async function writeDiversityAwareCorpus({
  stackDepthPath = DEFAULT_STEP32_STACK_DEPTH_OUTPUT_PATH,
  drawRoundPath = DEFAULT_STEP32_DRAW_ROUND_OUTPUT_PATH,
  playerCountPath = DEFAULT_STEP32_PLAYER_COUNT_OUTPUT_PATH,
  outputPath = DEFAULT_STEP32_DIVERSITY_CORPUS_OUTPUT_PATH,
  stackDepthReport,
  drawRoundReport,
  playerCountReport,
} = {}) {
  const report = buildDiversityAwareCorpus({
    stackDepthReport: stackDepthReport ?? (await readJsonIfExists(stackDepthPath)),
    drawRoundReport: drawRoundReport ?? (await readJsonIfExists(drawRoundPath)),
    playerCountReport: playerCountReport ?? (await readJsonIfExists(playerCountPath)),
  });
  return writeJsonReport(outputPath, report);
}

export async function writeStep32Reruns({
  corpusPath = DEFAULT_STEP32_DIVERSITY_CORPUS_OUTPUT_PATH,
  entropyInputPath = DEFAULT_STEP31_ENTROPY_INPUT_PATH,
  rejectionInputPath = DEFAULT_STEP31_REJECTION_INPUT_PATH,
} = {}) {
  const corpus = (await readJsonIfExists(corpusPath)) ?? (await writeDiversityAwareCorpus());
  const diversity = auditReplayDiversity({ rows: corpus.samples ?? [] });
  const writtenDiversity = await writeJsonReport(DEFAULT_STEP32_REPLAY_DIVERSITY_RERUN_OUTPUT_PATH, {
    ...diversity,
    outputPath: DEFAULT_STEP32_REPLAY_DIVERSITY_RERUN_OUTPUT_PATH,
  });

  const previousEntropy = (await readJsonIfExists(entropyInputPath))?.candidates ?? [];
  const entropy = mineEntropyAwareCandidates({
    candidates: [...previousEntropy, ...buildCoverageShadowCandidates(corpus.samples ?? [])],
  });
  const writtenEntropy = await writeJsonReport(DEFAULT_STEP32_ENTROPY_RERUN_OUTPUT_PATH, {
    ...entropy,
    outputPath: DEFAULT_STEP32_ENTROPY_RERUN_OUTPUT_PATH,
  });

  const rarity = scoreCandidateRarity({ candidates: writtenEntropy.candidates ?? [] });
  const writtenRarity = await writeJsonReport(DEFAULT_STEP32_RARITY_RERUN_OUTPUT_PATH, {
    ...rarity,
    outputPath: DEFAULT_STEP32_RARITY_RERUN_OUTPUT_PATH,
  });

  const rejection = await readJsonIfExists(rejectionInputPath);
  const queue = buildFutureCandidateQueue({
    entropyCandidates: writtenEntropy.candidates ?? [],
    rarityCandidates: writtenRarity.candidates ?? [],
    rejected: rejection?.rejected ?? [],
  });
  const writtenQueue = await writeJsonReport(DEFAULT_STEP32_QUEUE_RERUN_OUTPUT_PATH, {
    ...queue,
    outputPath: DEFAULT_STEP32_QUEUE_RERUN_OUTPUT_PATH,
  });
  return { diversity: writtenDiversity, entropy: writtenEntropy, rarity: writtenRarity, queue: writtenQueue };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const corpus = await writeDiversityAwareCorpus();
  const reruns = await writeStep32Reruns({ corpusPath: corpus.outputPath });
  console.log(JSON.stringify({ corpus, reruns }, null, 2));
}
