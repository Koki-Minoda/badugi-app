import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_REPRODUCIBILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/replay-reproducibility-step33.json",
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

function replayHash(sample = {}) {
  const payload = {
    sampleId: sample.sampleId,
    variant: sample.variant,
    stackDepth: sample.stackDepth,
    drawRound: sample.drawRound,
    playerCount: sample.playerCount,
    pressureFamily: sample.pressureFamily,
    position: sample.position,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function countMismatches(samples = []) {
  const seen = new Map();
  let mismatches = 0;
  samples.forEach((sample) => {
    const hash = replayHash(sample);
    if (seen.has(sample.sampleId) && seen.get(sample.sampleId) !== hash) mismatches += 1;
    seen.set(sample.sampleId, hash);
  });
  return mismatches;
}

export function auditReplayReproducibility({ signals = [] } = {}) {
  const bySignal = signals.map((signal) => {
    const samples = signal.replaySamples ?? [];
    return {
      signal: signal.signal,
      replaySampleCount: samples.length,
      deterministicReplay: signal.deterministicReplay === true,
      invalidReplayCount: Number(signal.invalidReplayCount ?? 0),
      illegal: Number(signal.illegal ?? 0),
      freeze: Number(signal.freeze ?? 0),
      mismatchCount: countMismatches(samples),
      hashes: samples.map((sample) => ({ sampleId: sample.sampleId, hash: replayHash(sample) })),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    signals: bySignal,
    deterministicReplay: bySignal.every((entry) => entry.deterministicReplay === true),
    invalidReplayCount: bySignal.reduce((sum, entry) => sum + entry.invalidReplayCount, 0),
    illegal: bySignal.reduce((sum, entry) => sum + entry.illegal, 0),
    freeze: bySignal.reduce((sum, entry) => sum + entry.freeze, 0),
    mismatchCount: bySignal.reduce((sum, entry) => sum + entry.mismatchCount, 0),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP33_REPRODUCIBILITY_OUTPUT_PATH,
  };
}

export async function writeReplayReproducibilityAudit({
  acquisitionPath = DEFAULT_STEP33_SHADOW_ACQUISITION_INPUT_PATH,
  outputPath = DEFAULT_STEP33_REPRODUCIBILITY_OUTPUT_PATH,
  signals,
} = {}) {
  const acquisition = signals ? { signals } : await readJsonIfExists(acquisitionPath);
  return writeJsonReport(outputPath, auditReplayReproducibility({ signals: acquisition?.signals ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayReproducibilityAudit();
  console.log(JSON.stringify(report, null, 2));
}
