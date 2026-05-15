import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP31_CANDIDATE_RARITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/candidate-rarity-step31.json",
);
export const DEFAULT_STEP31_ENTROPY_CANDIDATES_INPUT_PATH = path.resolve(
  "reports/ai-iron/entropy-aware-candidates-step31.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function classifyRarity({ frequency, matchability, replayScarcity, coverageRarity }) {
  if (frequency < 10 || matchability < 0.35) return "TOO_RARE";
  if (replayScarcity > 0.75 || coverageRarity > 0.85) return "SHADOW_ONLY";
  return "VIABLE";
}

export function scoreCandidateRarity({ candidates = [], maxObservedFrequency } = {}) {
  const maxFrequency = Math.max(1, Number(maxObservedFrequency ?? 0), ...candidates.map((entry) => Number(entry.frequency ?? 0)));
  const scored = candidates.map((entry) => {
    const frequency = Number(entry.frequency ?? 0);
    const opportunityRarity = roundNumber(1 - Math.min(1, frequency / maxFrequency), 4);
    const coverageRarity = roundNumber(entry.coverageRarity ?? (entry.classification === "SAFE_CANDIDATE" ? 0.35 : 0.7), 4);
    const replayScarcity = roundNumber(entry.replayScarcity ?? Math.max(0, 1 - frequency / 100), 4);
    const matchability = roundNumber(entry.matchability ?? Math.min(1, frequency / 30) * (1 - Math.min(1, Number(entry.signFlipRate ?? 0))), 4);
    const classification = classifyRarity({ frequency, matchability, replayScarcity, coverageRarity });
    return {
      candidate: entry.candidate ?? `${entry.variant ?? "unknown"} ${entry.bucket ?? "unknown"}`,
      variant: entry.variant ?? null,
      bucket: entry.bucket ?? null,
      frequency,
      opportunityRarity,
      coverageRarity,
      replayScarcity,
      matchability,
      classification,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    candidates: scored,
    viableCount: scored.filter((entry) => entry.classification === "VIABLE").length,
    tooRareCount: scored.filter((entry) => entry.classification === "TOO_RARE").length,
    shadowOnlyCount: scored.filter((entry) => entry.classification === "SHADOW_ONLY").length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_CANDIDATE_RARITY_OUTPUT_PATH,
  };
}

export async function writeCandidateRarityScores({
  inputPath = DEFAULT_STEP31_ENTROPY_CANDIDATES_INPUT_PATH,
  outputPath = DEFAULT_STEP31_CANDIDATE_RARITY_OUTPUT_PATH,
  candidates,
} = {}) {
  const report = candidates ? { candidates } : await readJsonIfExists(inputPath);
  return writeJsonReport(outputPath, scoreCandidateRarity({ candidates: report?.candidates ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCandidateRarityScores();
  console.log(JSON.stringify(report, null, 2));
}
