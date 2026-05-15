import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP30_NEXT_CANDIDATE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/next-safe-coverage-candidate-step30.json",
);
export const DEFAULT_STEP27_RANKING_PATH = path.resolve(
  "reports/ai-iron/coverage-expansion-ranking-step27.json",
);
export const DEFAULT_STEP30_RANKING_PATH = path.resolve(
  "reports/ai-iron/coverage-expansion-ranking-step30.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function isExcluded(entry = {}) {
  const text = `${entry.variant ?? ""} ${entry.bucketFamily ?? ""}`.toLowerCase();
  return (
    text.includes("d01") ||
    text.includes("weak") ||
    text.includes("trash") ||
    Number(entry.signFlipRate ?? 0) > 0.2 ||
    Number(entry.repairRate ?? 0) > 0.1 ||
    ["HIGH_ENTROPY", "UNEXPORTABLE"].includes(String(entry.entropyClassification ?? "")) ||
    Boolean(entry.sourcePriorityOverride) ||
    Boolean(entry.requiresGameplayMutation)
  );
}

function downgradeClosedCandidate(entry = {}) {
  if (entry.variant === "S02" && entry.bucketFamily === "lowerMediumSDA5 bet-pressure") {
    return {
      ...entry,
      priority: "P3_MONITOR_ONLY",
      score: 0,
      nextAction: "monitor only; do not export after forced replay signFlip=0.4333 and confidence=0.4250",
      risk: "unstable forced replay distribution",
      closure: {
        step: "Step29",
        decision: "DO_NOT_EXPORT",
        status: "COUNTERFACTUAL_ONLY",
        reason: ["signFlip-too-high", "confidence-too-low", "entropy-not-isolated"],
      },
    };
  }
  return entry;
}

export function updateCoverageRankingForClosure({ rankingReport = {} } = {}) {
  const ranking = (rankingReport.ranking ?? []).map(downgradeClosedCandidate);
  return {
    ...rankingReport,
    generatedAt: new Date().toISOString(),
    ranking,
    closureApplied: true,
    closedCandidate: "S02 lowerMediumSDA5 bet-pressure",
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    outputPath: DEFAULT_STEP30_RANKING_PATH,
  };
}

export function searchNextSafeCoverageCandidate({ ranking = [] } = {}) {
  const candidates = ranking
    .filter((entry) => entry.priority !== "DO_NOT_TOUCH")
    .filter((entry) => entry.priority !== "P3_MONITOR_ONLY")
    .filter((entry) => !isExcluded(entry))
    .map((entry) => ({
      candidate: `${entry.variant} ${entry.bucketFamily}`,
      variant: entry.variant,
      bucketFamily: entry.bucketFamily,
      priority: entry.priority === "P1_EXPAND_NEXT" ? "P2_COUNTERFACTUAL_FIRST" : entry.priority,
      score: entry.score ?? 0,
      reason: "non-weak/non-trash candidate with replay-verifiable evidence",
      sourcePriorityOverride: false,
      requiresGameplayMutation: false,
    }))
    .sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0));
  const next = candidates[0] ?? null;
  return {
    generatedAt: new Date().toISOString(),
    classification: next ? next.priority : "NONE_FOUND",
    nextCandidate: next,
    excludedRules: [
      "exclude weak/trash broad buckets",
      "exclude D01",
      "exclude signFlip > 0.20",
      "exclude repairRate > 0.10",
      "exclude high entropy",
      "exclude source priority override",
      "exclude gameplay mutation required",
    ],
    candidateCount: candidates.length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP30_NEXT_CANDIDATE_OUTPUT_PATH,
  };
}

export async function writeStep30CoverageRanking({
  inputPath = DEFAULT_STEP27_RANKING_PATH,
  outputPath = DEFAULT_STEP30_RANKING_PATH,
} = {}) {
  const rankingReport = (await readJsonIfExists(inputPath)) ?? { ranking: [] };
  const report = updateCoverageRankingForClosure({ rankingReport });
  return writeJsonReport(outputPath, report);
}

export async function writeNextSafeCoverageCandidate({
  rankingPath = DEFAULT_STEP30_RANKING_PATH,
  outputPath = DEFAULT_STEP30_NEXT_CANDIDATE_OUTPUT_PATH,
} = {}) {
  const rankingReport = (await readJsonIfExists(rankingPath)) ?? (await writeStep30CoverageRanking());
  const report = searchNextSafeCoverageCandidate({ ranking: rankingReport.ranking ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const ranking = await writeStep30CoverageRanking();
  const report = await writeNextSafeCoverageCandidate({ rankingPath: ranking.outputPath });
  console.log(JSON.stringify(report, null, 2));
}
