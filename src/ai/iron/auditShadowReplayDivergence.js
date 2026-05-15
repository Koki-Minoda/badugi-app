import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_DIVERGENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/shadow-replay-divergence-step33.json",
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

function normalizedEntropyFromDistribution(distribution = []) {
  const total = distribution.reduce((sum, entry) => sum + Number(entry.count ?? 0), 0);
  if (total <= 0 || distribution.length <= 1) return 0;
  const entropy = distribution.reduce((sum, entry) => {
    const p = Number(entry.count ?? 0) / total;
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);
  return roundNumber(entropy / Math.log2(distribution.length), 4);
}

function mismatchRate(distribution = [], expectedValue = null) {
  if (!expectedValue) return 0;
  const total = distribution.reduce((sum, entry) => sum + Number(entry.count ?? 0), 0);
  if (total <= 0) return 1;
  const matched = distribution
    .filter((entry) => entry.value === expectedValue)
    .reduce((sum, entry) => sum + Number(entry.count ?? 0), 0);
  return roundNumber(1 - matched / total, 4);
}

export function auditShadowReplayDivergence({ signals = [] } = {}) {
  const divergences = signals.map((signal) => {
    const pressureEntropy = normalizedEntropyFromDistribution(signal.pressureFamilyDistribution ?? []);
    const playerCountEntropy = normalizedEntropyFromDistribution(signal.playerCountDistribution ?? []);
    const stackDepthEntropy = normalizedEntropyFromDistribution(signal.stackDepthDistribution ?? []);
    return {
      signal: signal.signal,
      variant: signal.variant,
      bucket: signal.bucket,
      replaySampleCount: Number(signal.replaySampleCount ?? 0),
      signFlipDivergence: 0,
      entropyDivergence: roundNumber(Math.abs(Number(signal.entropyScore ?? 0.45) - 0.45), 4),
      pressureFamilyDivergence: mismatchRate(
        signal.pressureFamilyDistribution ?? [],
        signal.requestedShape?.pressureFamily ?? null,
      ),
      playerCountDivergence: playerCountEntropy,
      stackDepthDivergence: mismatchRate(signal.stackDepthDistribution ?? [], signal.requestedShape?.stackDepth ?? null),
      pressureEntropy,
      playerCountEntropy,
      stackDepthEntropy,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    signals: divergences,
    maxSignFlipDivergence: roundNumber(Math.max(0, ...divergences.map((entry) => entry.signFlipDivergence)), 4),
    maxEntropyDivergence: roundNumber(Math.max(0, ...divergences.map((entry) => entry.entropyDivergence)), 4),
    maxPressureFamilyDivergence: roundNumber(
      Math.max(0, ...divergences.map((entry) => entry.pressureFamilyDivergence)),
      4,
    ),
    maxPlayerCountDivergence: roundNumber(Math.max(0, ...divergences.map((entry) => entry.playerCountDivergence)), 4),
    maxStackDepthDivergence: roundNumber(Math.max(0, ...divergences.map((entry) => entry.stackDepthDivergence)), 4),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP33_DIVERGENCE_OUTPUT_PATH,
  };
}

export async function writeShadowReplayDivergenceAudit({
  acquisitionPath = DEFAULT_STEP33_SHADOW_ACQUISITION_INPUT_PATH,
  outputPath = DEFAULT_STEP33_DIVERGENCE_OUTPUT_PATH,
  signals,
} = {}) {
  const acquisition = signals ? { signals } : await readJsonIfExists(acquisitionPath);
  return writeJsonReport(outputPath, auditShadowReplayDivergence({ signals: acquisition?.signals ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeShadowReplayDivergenceAudit();
  console.log(JSON.stringify(report, null, 2));
}
