import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_STEP41_EXACT_OPPORTUNITY_OUTPUT_PATH,
  STEP41_TARGET_PLAYER_COUNTS,
} from "./acquireS02DeepExactOpportunities.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP41_OPPORTUNITY_SAMPLER_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-opportunity-biased-sampler-step41.json",
);

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(rows = [], keyFn = () => "") {
  return rows.reduce((counts, row) => {
    const key = String(keyFn(row));
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export async function buildOpportunityBiasedReplaySampler({
  opportunitiesPath = DEFAULT_STEP41_EXACT_OPPORTUNITY_OUTPUT_PATH,
  outputPath = DEFAULT_STEP41_OPPORTUNITY_SAMPLER_OUTPUT_PATH,
  targetPerPlayerCount = 50,
  rows = null,
} = {}) {
  const parsedRows = rows ?? (await readJsonl(opportunitiesPath));
  const summary = parsedRows.find((row) => row.type === "summary") ?? {};
  const opportunities = parsedRows.filter((row) => row.type === "opportunity");
  const byPlayerCount = countBy(opportunities, (row) => row.playerCount);
  const samplerPlan = STEP41_TARGET_PLAYER_COUNTS.map((playerCount) => {
    const available = Number(byPlayerCount[String(playerCount)] ?? 0);
    return {
      playerCount,
      priority: playerCount === 3 ? 1 : 2,
      availableReplaySamples: available,
      targetSamples: targetPerPlayerCount,
      selectedSamples: Math.min(available, targetPerPlayerCount),
      deterministicOrdering: "sampleFile,seed,handId,step,actorSeat",
      selectionMode: "corpus-filtering-and-replay-prioritization",
    };
  });
  const selectedTotal = samplerPlan.reduce((sum, entry) => sum + entry.selectedSamples, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    sourceOpportunityPath: opportunitiesPath,
    acquisitionExactOpportunityCount: Number(summary.exactOpportunityCount ?? opportunities.length),
    candidateReplayCount: Number(summary.candidateReplayCount ?? 0),
    opportunityDistribution: byPlayerCount,
    samplerPlan,
    selectedTotal,
    targetCoverage: roundNumber(selectedTotal / Math.max(1, targetPerPlayerCount * STEP41_TARGET_PLAYER_COUNTS.length), 4),
    allowedMechanism: ["corpus filtering", "replay prioritization", "deterministic replay ordering"],
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
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildOpportunityBiasedReplaySampler();
  console.log(JSON.stringify(report, null, 2));
}
