import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_STEP17_OPPORTUNITY_OUTPUT_PATH,
  DEFAULT_STEP17_NEAR_MISS_OUTPUT_PATH,
} from "./profileS02RelaxedOpportunity.js";

export const DEFAULT_STEP17_EXACT_TRACE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-exact-opportunity-trace-step17.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function analyzeS02ExactOpportunityTrace({
  opportunityPath = DEFAULT_STEP17_OPPORTUNITY_OUTPUT_PATH,
  nearMissPath = DEFAULT_STEP17_NEAR_MISS_OUTPUT_PATH,
  outputPath = DEFAULT_STEP17_EXACT_TRACE_OUTPUT_PATH,
} = {}) {
  const summary = await readJson(opportunityPath);
  const nearMisses = await readJsonl(nearMissPath);
  const report = {
    targetBucket: summary.targetBucket,
    exactOpportunities: Number(summary.exactOpportunities ?? 0),
    datasetHits: Number(summary.finalDatasetHits ?? 0),
    nearMisses: Number(summary.nearMisses ?? 0),
    playerCountTransitions: summary.playerCountTransitions ?? {},
    activePlayersAtHandStart: summary.activePlayersAtHandStart ?? {},
    activePlayersAtDecision: summary.activePlayersAtDecision ?? {},
    effectivePlayerCount: summary.effectivePlayerCount ?? {},
    mismatchReasons: summary.mismatchReasons ?? {},
    sampleTrace: nearMisses.slice(0, 20).map((entry) => ({
      decisionId: entry.decisionId,
      activePlayersAtHandStart: entry.activePlayersAtHandStart,
      activePlayersAtDecision: entry.activePlayersAtDecision,
      effectivePlayerCount: entry.effectivePlayerCount,
      handClass: entry.handClass,
      position: entry.position,
      callBand: entry.callBand,
      pressureChain: entry.pressureChain,
      exactOpportunity: entry.exactOpportunity,
      datasetHit: entry.mismatchReason === "EXACT_HIT",
      selectedAction: entry.selectedAction ?? null,
      datasetAction: entry.datasetAction ?? null,
      mismatchReason: entry.mismatchReason ?? "UNKNOWN",
      evImpact: 0,
    })),
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return { outputPath, report };
}
