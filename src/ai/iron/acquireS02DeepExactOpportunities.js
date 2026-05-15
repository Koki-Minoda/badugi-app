import fs from "node:fs/promises";
import path from "node:path";

import { parseReplaySampleFilename } from "../evaluation/counterfactualBuckets.js";
import { actionName, stackDepth } from "./s02CounterfactualUtils.js";
import { roundNumber } from "./coverageAuditUtils.js";

export const DEFAULT_STEP41_EXACT_OPPORTUNITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-exact-opportunities-step41.jsonl",
);
export const STEP41_REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");
export const STEP41_TARGET_PLAYER_COUNTS = [3, 4];

function legalTypes(sample = {}) {
  return new Set((sample.legalActions ?? []).map((action) => actionName(action)));
}

function isExactOpportunity(sample = {}) {
  const legal = legalTypes(sample);
  return (
    String(sample.variantId ?? "").toUpperCase() === "S02" &&
    stackDepth(sample) === "deep" &&
    actionName(sample.standardAction) === "RAISE" &&
    actionName(sample.proAction) === "CHECK" &&
    STEP41_TARGET_PLAYER_COUNTS.includes(Number(sample.playerCount ?? 0)) &&
    legal.has("RAISE") &&
    legal.has("CHECK")
  );
}

function opportunityKey(sample = {}) {
  return [
    sample.variantId,
    sample.seed,
    sample.handId,
    sample.step,
    sample.actorSeat,
    sample.playerCount,
  ].join("|");
}

function emptyBranch(playerCount) {
  return {
    playerCount,
    exactOpportunityCount: 0,
    exactLegalCount: 0,
    candidateReplayCount: 0,
    replaySamples: 0,
  };
}

export async function acquireS02DeepExactOpportunities({
  sampleDir = STEP41_REPLAY_SAMPLE_DIR,
  outputPath = DEFAULT_STEP41_EXACT_OPPORTUNITY_OUTPUT_PATH,
  minDecisionScan = 250000,
  maxExamples = 2000,
} = {}) {
  const files = (await fs.readdir(sampleDir).catch(() => []))
    .filter((file) => file.endsWith(".jsonl"))
    .sort();
  const branches = new Map(STEP41_TARGET_PLAYER_COUNTS.map((count) => [String(count), emptyBranch(count)]));
  const seen = new Set();
  const opportunities = [];
  let decisionsScanned = 0;

  for (const file of files) {
    const parsed = parseReplaySampleFilename(file);
    const content = await fs.readFile(path.join(sampleDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      decisionsScanned += 1;
      let sample = null;
      try {
        sample = JSON.parse(line);
      } catch {
        continue;
      }
      if (String(sample.variantId ?? "").toUpperCase() !== "S02") continue;
      const count = Number(sample.playerCount ?? 0);
      if (branches.has(String(count))) branches.get(String(count)).candidateReplayCount += 1;
      if (!isExactOpportunity(sample)) continue;
      const key = opportunityKey(sample);
      if (seen.has(key)) continue;
      seen.add(key);
      const branch = branches.get(String(count));
      branch.exactOpportunityCount += 1;
      branch.exactLegalCount += 1;
      branch.replaySamples += 1;
      if (opportunities.length < maxExamples) {
        opportunities.push({
          type: "opportunity",
          key,
          variant: "S02",
          playerCount: count,
          stackDepth: "deep",
          actionPair: "RAISE-vs-CHECK",
          sampleTag: parsed?.tag ?? "unknown",
          sampleFile: file,
          seed: sample.seed ?? null,
          handId: sample.handId ?? null,
          step: sample.step ?? null,
          actorSeat: sample.actorSeat ?? null,
          legalActions: [...legalTypes(sample)].sort(),
        });
      }
    }
  }

  const branchRows = [...branches.values()];
  const exactOpportunityCount = branchRows.reduce((sum, branch) => sum + branch.exactOpportunityCount, 0);
  const exactLegalCount = branchRows.reduce((sum, branch) => sum + branch.exactLegalCount, 0);
  const candidateReplayCount = branchRows.reduce((sum, branch) => sum + branch.candidateReplayCount, 0);
  const summary = {
    type: "summary",
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    minDecisionScan,
    decisionsScanned,
    scanTargetMet: decisionsScanned >= minDecisionScan,
    exactOpportunityCount,
    exactLegalCount,
    candidateReplayCount,
    exactOpportunityRate: roundNumber(exactOpportunityCount / Math.max(1, decisionsScanned), 6),
    branches: branchRows,
    hiddenStateInjection: false,
    syntheticStateInjection: false,
    gameplayMutation: false,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    sourcePriorityChanged: false,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, [summary, ...opportunities].map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  return { ...summary, outputPath, writtenOpportunityRows: opportunities.length };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await acquireS02DeepExactOpportunities();
  console.log(JSON.stringify(report, null, 2));
}
