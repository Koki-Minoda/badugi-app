import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_FORCED_ELIGIBILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/forced-replay-eligibility-step33.json",
);
export const DEFAULT_STEP33_REPLAY_VALIDATION_INPUT_PATH = path.resolve(
  "reports/ai-iron/replay-backed-signal-validation-step33.json",
);
export const DEFAULT_STEP33_REPRODUCIBILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/replay-reproducibility-step33.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function classifyEligibility(validation = {}, reproducibility = null, entropyThreshold = 0.65) {
  if (
    validation.deterministicReplay !== true ||
    reproducibility?.deterministicReplay !== true ||
    Number(validation.invalidReplayCount ?? 0) > 0 ||
    Number(validation.illegal ?? 0) > 0 ||
    Number(validation.freeze ?? 0) > 0 ||
    Number(reproducibility?.mismatchCount ?? 0) > 0
  ) {
    return { eligibility: "REJECT", reason: ["replay-not-reproducible"] };
  }
  if (
    validation.classification === "REPLAY_VALIDATED" &&
    Number(validation.signFlipRate ?? 0) <= 0.2 &&
    Number(validation.repairRate ?? 0) <= 0.1 &&
    Number(validation.entropyScore ?? 0.45) <= entropyThreshold
  ) {
    return { eligibility: "FORCED_REPLAY_READY", reason: ["clean-replay-backed-signal"] };
  }
  if (validation.classification === "COUNTERFACTUAL_ONLY") {
    return { eligibility: "COUNTERFACTUAL_ONLY", reason: validation.reason ?? ["counterfactual-only"] };
  }
  if (validation.classification === "DO_NOT_TOUCH") return { eligibility: "REJECT", reason: validation.reason ?? [] };
  return { eligibility: "MONITOR_ONLY", reason: validation.reason ?? ["monitor-only"] };
}

export function scanForcedReplayEligibility({ validations = [], reproducibilitySignals = [], entropyThreshold = 0.65 } = {}) {
  const reproBySignal = new Map(reproducibilitySignals.map((entry) => [entry.signal, entry]));
  const candidates = validations.map((validation) => {
    const result = classifyEligibility(validation, reproBySignal.get(validation.signal), entropyThreshold);
    return {
      signal: validation.signal,
      variant: validation.variant,
      bucket: validation.bucket,
      replaySampleCount: validation.replaySampleCount,
      signFlipRate: validation.signFlipRate,
      repairRate: validation.repairRate,
      entropyScore: validation.entropyScore,
      eligibility: result.eligibility,
      reason: result.reason,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    candidates,
    readyCount: candidates.filter((entry) => entry.eligibility === "FORCED_REPLAY_READY").length,
    counterfactualOnlyCount: candidates.filter((entry) => entry.eligibility === "COUNTERFACTUAL_ONLY").length,
    monitorOnlyCount: candidates.filter((entry) => entry.eligibility === "MONITOR_ONLY").length,
    rejectCount: candidates.filter((entry) => entry.eligibility === "REJECT").length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP33_FORCED_ELIGIBILITY_OUTPUT_PATH,
  };
}

export async function writeForcedReplayEligibility({
  validationPath = DEFAULT_STEP33_REPLAY_VALIDATION_INPUT_PATH,
  reproducibilityPath = DEFAULT_STEP33_REPRODUCIBILITY_INPUT_PATH,
  outputPath = DEFAULT_STEP33_FORCED_ELIGIBILITY_OUTPUT_PATH,
  validations,
  reproducibilitySignals,
} = {}) {
  const validationReport = validations ? { signals: validations } : await readJsonIfExists(validationPath);
  const reproducibilityReport = reproducibilitySignals ? { signals: reproducibilitySignals } : await readJsonIfExists(reproducibilityPath);
  return writeJsonReport(
    outputPath,
    scanForcedReplayEligibility({
      validations: validationReport?.signals ?? [],
      reproducibilitySignals: reproducibilityReport?.signals ?? [],
    }),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeForcedReplayEligibility();
  console.log(JSON.stringify(report, null, 2));
}
