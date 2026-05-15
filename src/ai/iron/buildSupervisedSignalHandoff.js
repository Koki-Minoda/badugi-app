import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { readJsonl } from "./buildRLSignalPreview.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP47_SUPERVISED_HANDOFF_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-supervised-signal-handoff.json",
);

function rowsByBucket(rows = []) {
  return new Map(rows.map((row) => [String(row.bucket ?? ""), row]));
}

export function classifySupervisedSignal({ candidate = {}, row = {} } = {}) {
  const exactHits = Number(candidate.exactHits ?? 0);
  const exactOpportunities = Number(candidate.exactOpportunities ?? 0);
  const exactHitRate = exactHits / Math.max(1, exactOpportunities);
  const forcedReplay = row.forcedReplay ?? {};
  const deterministic = candidate.deterministic === true && forcedReplay.deterministicReplay !== false;
  if (candidate.legal !== true || deterministic !== true || Number(forcedReplay.invalidReplayCount ?? 1) !== 0) {
    return "MONITOR_ONLY";
  }
  if (
    exactHitRate === 1 &&
    Number(forcedReplay.confidence ?? 0) >= 0.95 &&
    Number(forcedReplay.signFlipRate ?? 1) <= 0.05
  ) {
    return "READY_FOR_SUPERVISED_TRAINING";
  }
  if (exactHits > 0 && Number(candidate.estimatedEVGain ?? 0) > 0) return "READY_FOR_COACHING_ONLY";
  return "MONITOR_ONLY";
}

function emptyCategories() {
  return {
    READY_FOR_SUPERVISED_TRAINING: 0,
    READY_FOR_COACHING_ONLY: 0,
    MONITOR_ONLY: 0,
  };
}

export function buildSupervisedSignalHandoffSummary({ candidates = [], preexportRows = [] } = {}) {
  const byBucket = rowsByBucket(preexportRows);
  const categories = emptyCategories();
  const rows = candidates.map((candidate) => {
    const sourceRow = byBucket.get(candidate.bucket) ?? {};
    const forcedReplay = sourceRow.forcedReplay ?? {};
    const exactHitRate = roundNumber(Number(candidate.exactHits ?? 0) / Math.max(1, Number(candidate.exactOpportunities ?? 0)), 4);
    const category = classifySupervisedSignal({ candidate, row: sourceRow });
    categories[category] += 1;
    return {
      candidateId: `S02_DEEP_RAISECHECK_PC${candidate.playerCount ?? "UNKNOWN"}`,
      variantId: candidate.variantId ?? sourceRow.variantId ?? "S02",
      bucket: candidate.bucket ?? sourceRow.bucket ?? null,
      playerCount: Number(candidate.playerCount ?? sourceRow.playerCount ?? 0),
      category,
      recommendedAction: candidate.ironAction,
      baselineAction: candidate.proAction,
      exactHits: Number(candidate.exactHits ?? 0),
      exactOpportunities: Number(candidate.exactOpportunities ?? 0),
      exactHitRate,
      confidence: roundNumber(forcedReplay.confidence, 4),
      signFlipRate: roundNumber(forcedReplay.signFlipRate, 4),
      invalidReplayCount: Number(forcedReplay.invalidReplayCount ?? 0),
      deterministic: candidate.deterministic === true && forcedReplay.deterministicReplay !== false,
      trainingDatasetMutation: false,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: "step46-candidates-plus-step38-forced-replay-metadata",
    categories,
    rows,
    trainingDatasetMutation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function buildSupervisedSignalHandoff({
  candidatesPath = path.resolve("reports/ai-iron/step46-coaching-material-candidates.jsonl"),
  preexportRowsPath = path.resolve("reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl"),
  outputPath = DEFAULT_STEP47_SUPERVISED_HANDOFF_OUTPUT_PATH,
  candidates = null,
  preexportRows = null,
} = {}) {
  const report = buildSupervisedSignalHandoffSummary({
    candidates: candidates ?? (await readJsonl(candidatesPath)),
    preexportRows: preexportRows ?? (await readPreExportRows(preexportRowsPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildSupervisedSignalHandoff();
  console.log(JSON.stringify(report, null, 2));
}
