import fs from "node:fs/promises";
import path from "node:path";

import { average, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP33_SHADOW_ACQUISITION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/shadow-replay-acquisition-step33.json",
);
export const DEFAULT_STEP32_QUEUE_INPUT_PATH = path.resolve(
  "reports/ai-iron/future-candidate-queue-rerun-step32.json",
);
export const DEFAULT_STEP32_DIVERSITY_CORPUS_INPUT_PATH = path.resolve(
  "reports/ai-iron/diversity-aware-corpus-step32.json",
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

function cleanReplaySample(sample = {}) {
  return (
    sample.deterministicReplay === true &&
    Number(sample.invalidReplayCount ?? 0) === 0 &&
    Number(sample.illegal ?? 0) === 0 &&
    Number(sample.freeze ?? 0) === 0 &&
    sample.hiddenStateInjection !== true &&
    sample.gameplayMutation !== true &&
    sample.routingChanged !== true &&
    sample.sourcePriorityChanged !== true
  );
}

function distribution(samples = [], key) {
  const map = new Map();
  samples.forEach((sample) => map.set(sample[key] ?? "unknown", (map.get(sample[key] ?? "unknown") ?? 0) + 1));
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function parseSignal(entry = {}) {
  const bucket = String(entry.bucket ?? "");
  const stackDepth = bucket.match(/^coverage-shadow stackDepth (.+)$/)?.[1] ?? null;
  if (stackDepth) {
    return {
      kind: "coverage-shadow",
      replayFilter: { variant: entry.variant ?? "S02", stackDepth },
      requestedShape: { stackDepth },
      closedMonitorOnly: false,
    };
  }
  if (bucket === "lowerMediumSDA5 bet-pressure") {
    return {
      kind: "closed-monitor-only",
      replayFilter: { variant: entry.variant ?? "S02", pressureFamily: "bet-pressure" },
      requestedShape: { pressureFamily: "bet-pressure" },
      closedMonitorOnly: true,
    };
  }
  return {
    kind: "monitor-only",
    replayFilter: { variant: entry.variant },
    requestedShape: {},
    closedMonitorOnly: false,
  };
}

function matchesFilter(sample = {}, replayFilter = {}) {
  return Object.entries(replayFilter).every(([key, value]) => value == null || sample[key] === value);
}

function closureMetricsFor(entry = {}, closure = null) {
  if (`${entry.variant ?? ""} ${entry.bucket ?? ""}` !== closure?.candidate) return {};
  return {
    sampleCount: Number(closure.evidence?.sampleCount ?? 0),
    signFlipRate: Number(closure.evidence?.signFlipRate ?? 0),
    confidence: Number(closure.evidence?.confidence ?? 0),
    repairRate: Number(closure.evidence?.repairRate ?? 0),
    entropyScore: 0.8,
    closureDecision: closure.decision,
    closureReason: closure.reason ?? [],
  };
}

function signalMetrics(samples = [], entry = {}, closure = null) {
  const closureMetrics = closureMetricsFor(entry, closure);
  if (closureMetrics.closureDecision) return closureMetrics;
  return {
    sampleCount: samples.length,
    signFlipRate: roundNumber(average(samples.map((sample) => sample.signFlipRate ?? 0)), 4),
    confidence: roundNumber(Math.min(0.95, samples.length / 10), 4),
    repairRate: roundNumber(average(samples.map((sample) => sample.repairRate ?? 0)), 4),
    entropyScore: roundNumber(average(samples.map((sample) => sample.entropyScore ?? 0.45)), 4),
  };
}

export function acquireReplayFromShadowSignals({ queue = [], samples = [], closure = null, maxSamplesPerSignal = 50 } = {}) {
  const monitorSignals = queue.filter((entry) => entry.status === "MONITOR_ONLY");
  const acquiredSignals = monitorSignals.map((entry) => {
    const parsed = parseSignal(entry);
    const matched = samples
      .filter(cleanReplaySample)
      .filter((sample) => matchesFilter(sample, parsed.replayFilter))
      .sort((a, b) => String(a.sampleId).localeCompare(String(b.sampleId)))
      .slice(0, maxSamplesPerSignal);
    const metrics = signalMetrics(matched, entry, closure);
    return {
      signal: entry.candidate,
      variant: entry.variant,
      bucket: entry.bucket,
      kind: parsed.kind,
      requestedShape: parsed.requestedShape,
      replayFilter: parsed.replayFilter,
      replaySamples: matched.map((sample) => ({
        sampleId: sample.sampleId,
        variant: sample.variant,
        stackDepth: sample.stackDepth,
        drawRound: sample.drawRound,
        playerCount: sample.playerCount,
        pressureFamily: sample.pressureFamily,
        position: sample.position,
        entropyScore: sample.entropyScore,
      })),
      replaySampleCount: matched.length,
      playerCountDistribution: distribution(matched, "playerCount"),
      pressureFamilyDistribution: distribution(matched, "pressureFamily"),
      stackDepthDistribution: distribution(matched, "stackDepth"),
      signFlipRate: roundNumber(metrics.signFlipRate ?? 0, 4),
      confidence: roundNumber(metrics.confidence ?? 0, 4),
      repairRate: roundNumber(metrics.repairRate ?? 0, 4),
      entropyScore: roundNumber(metrics.entropyScore ?? 0.45, 4),
      closureDecision: metrics.closureDecision ?? null,
      closureReason: metrics.closureReason ?? [],
      deterministicReplay: matched.every((sample) => sample.deterministicReplay === true),
      invalidReplayCount: matched.reduce((sum, sample) => sum + Number(sample.invalidReplayCount ?? 0), 0),
      illegal: matched.reduce((sum, sample) => sum + Number(sample.illegal ?? 0), 0),
      freeze: matched.reduce((sum, sample) => sum + Number(sample.freeze ?? 0), 0),
      hiddenStateInjection: false,
      gameplayMutation: false,
      routingChanged: false,
      sourcePriorityChanged: false,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    signals: acquiredSignals,
    signalCount: acquiredSignals.length,
    totalReplaySamples: acquiredSignals.reduce((sum, signal) => sum + signal.replaySampleCount, 0),
    deterministicReplay: acquiredSignals.every((signal) => signal.deterministicReplay === true),
    invalidReplayCount: acquiredSignals.reduce((sum, signal) => sum + signal.invalidReplayCount, 0),
    illegal: acquiredSignals.reduce((sum, signal) => sum + signal.illegal, 0),
    freeze: acquiredSignals.reduce((sum, signal) => sum + signal.freeze, 0),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP33_SHADOW_ACQUISITION_OUTPUT_PATH,
  };
}

export async function writeShadowReplayAcquisition({
  queuePath = DEFAULT_STEP32_QUEUE_INPUT_PATH,
  corpusPath = DEFAULT_STEP32_DIVERSITY_CORPUS_INPUT_PATH,
  closurePath = DEFAULT_STEP30_CLOSURE_INPUT_PATH,
  outputPath = DEFAULT_STEP33_SHADOW_ACQUISITION_OUTPUT_PATH,
  queue,
  samples,
  closure,
} = {}) {
  const queueReport = queue ? { queue } : await readJsonIfExists(queuePath);
  const corpus = samples ? { samples } : await readJsonIfExists(corpusPath);
  const closureReport = closure === undefined ? await readJsonIfExists(closurePath) : closure;
  return writeJsonReport(
    outputPath,
    acquireReplayFromShadowSignals({
      queue: queueReport?.queue ?? [],
      samples: corpus?.samples ?? [],
      closure: closureReport,
    }),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeShadowReplayAcquisition();
  console.log(JSON.stringify(report, null, 2));
}
