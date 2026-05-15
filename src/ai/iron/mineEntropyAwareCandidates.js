import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { rejectionReasons } from "./rejectWeakTrashBucketsEarly.js";

export const DEFAULT_STEP31_ENTROPY_CANDIDATES_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/entropy-aware-candidates-step31.json",
);
export const DEFAULT_STEP27_MEDIUM_EV_INPUT_PATH = path.resolve(
  "reports/ai-iron/medium-ev-leak-candidates-step27.json",
);
export const DEFAULT_STEP27_HOTSPOTS_INPUT_PATH = path.resolve(
  "reports/ai-iron/iron-fallback-hotspots-step27.json",
);
export const DEFAULT_STEP30_CLOSURE_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-closure-step30.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function keyFor(entry = {}) {
  return `${entry.variant ?? entry.variantId ?? ""}|${entry.bucket ?? entry.bucketFamily ?? ""}`;
}

function mergeCandidateSources(reports = []) {
  const map = new Map();
  reports.flatMap((report) => report?.candidates ?? report?.hotspots ?? []).forEach((entry) => {
    const key = keyFor(entry);
    if (!map.has(key)) map.set(key, { ...entry, evidenceSources: [] });
    const current = map.get(key);
    current.frequency = Math.max(Number(current.frequency ?? 0), Number(entry.frequency ?? entry.sampleCount ?? 0));
    current.sampleCount = Math.max(Number(current.sampleCount ?? 0), Number(entry.sampleCount ?? entry.frequency ?? 0));
    current.standardAdvantage = Math.max(Number(current.standardAdvantage ?? 0), Number(entry.standardAdvantage ?? 0));
    current.confidence = Math.max(Number(current.confidence ?? 0), Number(entry.confidence ?? 0));
    current.signFlipRate = Math.max(Number(current.signFlipRate ?? 0), Number(entry.signFlipRate ?? 0));
    current.repairRate = Math.max(Number(current.repairRate ?? 0), Number(entry.repairRate ?? 0));
    current.invalidReplayCount = Math.max(Number(current.invalidReplayCount ?? 0), Number(entry.invalidReplayCount ?? 0));
    current.entropyScore = Math.max(Number(current.entropyScore ?? 0), Number(entry.entropyScore ?? 0));
    current.evidenceSources.push(entry.sourceType ?? entry.classification ?? "step27-report");
  });
  return [...map.values()];
}

function classifyEntropyCandidate(entry = {}) {
  const earlyReasons = rejectionReasons(entry).filter((reason) => reason !== "do-not-touch");
  if (earlyReasons.length) return { classification: "DO_NOT_TOUCH", reason: earlyReasons };
  const entropy = Number(entry.entropyScore ?? 0.45);
  if (entropy > 0.7) return { classification: "DO_NOT_TOUCH", reason: ["entropy-too-high"] };
  const frequency = Number(entry.frequency ?? entry.sampleCount ?? 0);
  const confidence = Number(entry.confidence ?? 0);
  const standardAdvantage = Number(entry.standardAdvantage ?? entry.meanDelta ?? 0);
  if (frequency >= 30 && confidence >= 0.8 && standardAdvantage > 0 && entropy >= 0.15 && entropy <= 0.65) {
    return { classification: "SAFE_CANDIDATE", reason: ["medium-entropy", "medium-frequency", "positive-stable-ev", "replay-clean"] };
  }
  if (frequency >= 10 && standardAdvantage > 0 && entropy <= 0.65) {
    return { classification: "COUNTERFACTUAL_ONLY", reason: ["needs-forced-replay-or-confidence"] };
  }
  return { classification: "MONITOR_ONLY", reason: ["insufficient-stable-signal"] };
}

export function mineEntropyAwareCandidates({ candidates = [] } = {}) {
  const mined = candidates.map((entry) => {
    const result = classifyEntropyCandidate(entry);
    return {
      candidate: `${entry.variant ?? entry.variantId ?? "unknown"} ${entry.bucket ?? entry.bucketFamily ?? "unknown"}`,
      variant: entry.variant ?? entry.variantId ?? null,
      bucket: entry.bucket ?? entry.bucketFamily ?? null,
      frequency: Number(entry.frequency ?? entry.sampleCount ?? 0),
      confidence: roundNumber(entry.confidence ?? 0, 4),
      standardAdvantage: roundNumber(entry.standardAdvantage ?? entry.meanDelta ?? 0, 4),
      signFlipRate: roundNumber(entry.signFlipRate ?? 0, 4),
      repairRate: roundNumber(entry.repairRate ?? 0, 4),
      invalidReplayCount: Number(entry.invalidReplayCount ?? 0),
      entropyScore: roundNumber(entry.entropyScore ?? 0.45, 4),
      classification: result.classification,
      reason: result.reason,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    candidates: mined,
    safeCandidateCount: mined.filter((entry) => entry.classification === "SAFE_CANDIDATE").length,
    counterfactualOnlyCount: mined.filter((entry) => entry.classification === "COUNTERFACTUAL_ONLY").length,
    monitorOnlyCount: mined.filter((entry) => entry.classification === "MONITOR_ONLY").length,
    doNotTouchCount: mined.filter((entry) => entry.classification === "DO_NOT_TOUCH").length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_ENTROPY_CANDIDATES_OUTPUT_PATH,
  };
}

export async function writeEntropyAwareCandidates({
  mediumEvPath = DEFAULT_STEP27_MEDIUM_EV_INPUT_PATH,
  hotspotsPath = DEFAULT_STEP27_HOTSPOTS_INPUT_PATH,
  closurePath = DEFAULT_STEP30_CLOSURE_INPUT_PATH,
  outputPath = DEFAULT_STEP31_ENTROPY_CANDIDATES_OUTPUT_PATH,
  candidates,
} = {}) {
  if (candidates) return writeJsonReport(outputPath, mineEntropyAwareCandidates({ candidates }));
  const reports = [await readJsonIfExists(mediumEvPath), await readJsonIfExists(hotspotsPath)].filter(Boolean);
  const merged = mergeCandidateSources(reports);
  const closure = await readJsonIfExists(closurePath);
  if (closure) {
    const closedEntry = {
      variant: "S02",
      bucket: "lowerMediumSDA5 bet-pressure",
      frequency: closure.evidence?.sampleCount ?? 0,
      confidence: closure.evidence?.confidence ?? 0,
      standardAdvantage: closure.evidence?.meanDelta ?? 0,
      signFlipRate: closure.evidence?.signFlipRate ?? 1,
      repairRate: closure.evidence?.repairRate ?? 0,
      invalidReplayCount: closure.evidence?.invalidReplays ?? 0,
      entropyScore: 0.8,
      status: closure.status,
    };
    const existingIndex = merged.findIndex((entry) => keyFor(entry) === keyFor(closedEntry));
    if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...closedEntry };
    else merged.push(closedEntry);
  }
  return writeJsonReport(outputPath, mineEntropyAwareCandidates({ candidates: merged }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeEntropyAwareCandidates();
  console.log(JSON.stringify(report, null, 2));
}
