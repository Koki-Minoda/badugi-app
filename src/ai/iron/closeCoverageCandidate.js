import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP30_CLOSURE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-closure-step30.json",
);
export const DEFAULT_STEP29_FORCED_REPLAY_DECISION_PATH = path.resolve(
  "reports/ai-iron/s02-exportability-decision-step29.json",
);
export const DEFAULT_STEP29_FORCED_REPLAY_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-forced-replay-step29.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function closeCoverageCandidate({
  candidate = "S02 lowerMediumSDA5 bet-pressure",
  forcedReplay = {},
  exportabilityDecision = {},
} = {}) {
  const reason = exportabilityDecision.blockers?.length
    ? exportabilityDecision.blockers
    : String(exportabilityDecision.reason ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const closureReason = reason.length ? reason : ["signFlip-too-high", "confidence-too-low", "entropy-not-isolated"];
  return {
    generatedAt: new Date().toISOString(),
    candidate,
    decision: "DO_NOT_EXPORT",
    status: "COUNTERFACTUAL_ONLY",
    reason: closureReason,
    monitorOnly: true,
    evidence: {
      sampleCount: forcedReplay.sampleCount ?? null,
      validReplays: forcedReplay.validReplays ?? null,
      invalidReplays: forcedReplay.invalidReplays ?? null,
      meanDelta: forcedReplay.meanDelta ?? null,
      medianDelta: forcedReplay.medianDelta ?? null,
      signFlipRate: forcedReplay.signFlipRate ?? null,
      confidence: forcedReplay.confidence ?? null,
      repairRate: forcedReplay.repairRate ?? null,
      verdict: forcedReplay.verdict ?? exportabilityDecision.decision ?? null,
    },
    reopenCriteria: {
      signFlipRateMax: 0.1,
      confidenceMin: 0.8,
      invalidReplays: 0,
      repairRateMax: 0.1,
      isolatedEntropyRequired: true,
    },
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP30_CLOSURE_OUTPUT_PATH,
  };
}

export async function writeCoverageCandidateClosure({
  outputPath = DEFAULT_STEP30_CLOSURE_OUTPUT_PATH,
  forcedReplayPath = DEFAULT_STEP29_FORCED_REPLAY_PATH,
  exportabilityDecisionPath = DEFAULT_STEP29_FORCED_REPLAY_DECISION_PATH,
  ...input
} = {}) {
  const forcedReplay = input.forcedReplay ?? (await readJsonIfExists(forcedReplayPath)) ?? {};
  const exportabilityDecision = input.exportabilityDecision ?? (await readJsonIfExists(exportabilityDecisionPath)) ?? {};
  const report = closeCoverageCandidate({ ...input, forcedReplay, exportabilityDecision });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCoverageCandidateClosure();
  console.log(JSON.stringify(report, null, 2));
}
