import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_REPLAY_VALIDATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/replay-backed-signal-validation-step33.json",
);
export const DEFAULT_STEP33_SHADOW_ACQUISITION_INPUT_PATH = path.resolve(
  "reports/ai-iron/shadow-replay-acquisition-step33.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function classifySignal(signal = {}) {
  if (signal.closureDecision === "DO_NOT_EXPORT" || signal.closureReason?.length) {
    return { classification: "MONITOR_ONLY", reason: ["closed-monitor-only"] };
  }
  if (
    signal.deterministicReplay !== true ||
    Number(signal.invalidReplayCount ?? 0) > 0 ||
    Number(signal.illegal ?? 0) > 0 ||
    Number(signal.freeze ?? 0) > 0
  ) {
    return { classification: "DO_NOT_TOUCH", reason: ["replay-not-clean"] };
  }
  if (Number(signal.replaySampleCount ?? 0) <= 0) {
    return { classification: "MONITOR_ONLY", reason: ["no-replay-samples"] };
  }
  if (Number(signal.repairRate ?? 0) > 0.1) {
    return { classification: "COUNTERFACTUAL_ONLY", reason: ["repair-dependency"] };
  }
  if (Number(signal.signFlipRate ?? 0) > 0.2) {
    return { classification: "COUNTERFACTUAL_ONLY", reason: ["signFlip-too-high"] };
  }
  if (Number(signal.entropyScore ?? 0.45) > 0.65) {
    return { classification: "MONITOR_ONLY", reason: ["entropy-too-high"] };
  }
  if (Number(signal.replaySampleCount ?? 0) >= 4) {
    return { classification: "REPLAY_VALIDATED", reason: ["deterministic-clean-replay", "stable-shadow-sign"] };
  }
  return { classification: "COUNTERFACTUAL_ONLY", reason: ["needs-more-replay-samples"] };
}

export function validateReplayBackedSignals({ signals = [] } = {}) {
  const validations = signals.map((signal) => {
    const result = classifySignal(signal);
    return {
      signal: signal.signal,
      variant: signal.variant,
      bucket: signal.bucket,
      replaySampleCount: Number(signal.replaySampleCount ?? 0),
      deterministicReplay: signal.deterministicReplay === true,
      invalidReplayCount: Number(signal.invalidReplayCount ?? 0),
      illegal: Number(signal.illegal ?? 0),
      freeze: Number(signal.freeze ?? 0),
      signFlipRate: Number(signal.signFlipRate ?? 0),
      confidence: Number(signal.confidence ?? 0),
      repairRate: Number(signal.repairRate ?? 0),
      entropyScore: Number(signal.entropyScore ?? 0.45),
      classification: result.classification,
      reason: result.reason,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    signals: validations,
    replayValidatedCount: validations.filter((entry) => entry.classification === "REPLAY_VALIDATED").length,
    counterfactualOnlyCount: validations.filter((entry) => entry.classification === "COUNTERFACTUAL_ONLY").length,
    monitorOnlyCount: validations.filter((entry) => entry.classification === "MONITOR_ONLY").length,
    doNotTouchCount: validations.filter((entry) => entry.classification === "DO_NOT_TOUCH").length,
    deterministicReplay: validations.every((entry) => entry.deterministicReplay === true),
    invalidReplayCount: validations.reduce((sum, entry) => sum + entry.invalidReplayCount, 0),
    illegal: validations.reduce((sum, entry) => sum + entry.illegal, 0),
    freeze: validations.reduce((sum, entry) => sum + entry.freeze, 0),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP33_REPLAY_VALIDATION_OUTPUT_PATH,
  };
}

export async function writeReplayBackedSignalValidation({
  acquisitionPath = DEFAULT_STEP33_SHADOW_ACQUISITION_INPUT_PATH,
  outputPath = DEFAULT_STEP33_REPLAY_VALIDATION_OUTPUT_PATH,
  signals,
} = {}) {
  const acquisition = signals ? { signals } : await readJsonIfExists(acquisitionPath);
  return writeJsonReport(outputPath, validateReplayBackedSignals({ signals: acquisition?.signals ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayBackedSignalValidation();
  console.log(JSON.stringify(report, null, 2));
}
