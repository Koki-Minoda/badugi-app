import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP31_DIVERSE_CORPUS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/diverse-corpus-generation-step31.json",
);
export const DEFAULT_STEP31_REPLAY_DIVERSITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/replay-diversity-step31.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function priorityForCoverage(coverage = 0) {
  if (coverage < 0.34) return "HIGH";
  if (coverage < 0.67) return "MEDIUM";
  return "LOW";
}

export function generateDiverseCounterfactualCorpus({ diversityReport = {}, targetSamplesPerGap = 40 } = {}) {
  const targets = (diversityReport.dimensions ?? [])
    .filter((dimension) => ["pressureFamily", "playerCount", "stackDepth", "drawRound", "position"].includes(dimension.dimension))
    .map((dimension) => ({
      dimension: dimension.dimension,
      currentCoverage: roundNumber(dimension.coverage ?? 0, 4),
      currentEntropy: roundNumber(dimension.entropy ?? 0, 4),
      priority: priorityForCoverage(Number(dimension.coverage ?? 0)),
      targetSamples: priorityForCoverage(Number(dimension.coverage ?? 0)) === "HIGH" ? targetSamplesPerGap : Math.ceil(targetSamplesPerGap / 2),
      samplingRule: `prefer rare ${dimension.dimension} values while preserving legal deterministic replay`,
    }))
    .sort((left, right) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return rank[right.priority] - rank[left.priority] || left.currentCoverage - right.currentCoverage;
    });

  return {
    generatedAt: new Date().toISOString(),
    mode: "deterministic-counterfactual-corpus-plan",
    mutationPolicy: "no gameplay mutation; no dataset export; legality clean replay only",
    samplingPriority: [
      "rare pressure family",
      "rare playerCount",
      "rare stackDepth",
      "rare drawRound",
      "rare position",
    ],
    targets,
    estimatedReplayTargets: targets.reduce((sum, target) => sum + Number(target.targetSamples ?? 0), 0),
    deterministicReplayRequired: true,
    legalityCleanRequired: true,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_DIVERSE_CORPUS_OUTPUT_PATH,
  };
}

export async function writeDiverseCounterfactualCorpusPlan({
  inputPath = DEFAULT_STEP31_REPLAY_DIVERSITY_INPUT_PATH,
  outputPath = DEFAULT_STEP31_DIVERSE_CORPUS_OUTPUT_PATH,
  diversityReport,
} = {}) {
  const report = diversityReport ?? (await readJsonIfExists(inputPath)) ?? { dimensions: [] };
  return writeJsonReport(outputPath, generateDiverseCounterfactualCorpus({ diversityReport: report }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeDiverseCounterfactualCorpusPlan();
  console.log(JSON.stringify(report, null, 2));
}
