import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { readJsonl } from "./buildRLSignalPreview.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP47_COACHING_HANDOFF_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-coaching-handoff-package.json",
);

export const STEP47_CANDIDATES_PATH = path.resolve("reports/ai-iron/step46-coaching-material-candidates.jsonl");
export const STEP47_REPEATABILITY_PATH = path.resolve("reports/ai-iron/step46-natural-repeatability-summary.json");
export const STEP47_PREEXPORT_ROWS_PATH = path.resolve("reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl");

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

export function candidateIdFor(candidate = {}) {
  const playerCount = Number(candidate.playerCount ?? 0);
  return `S02_DEEP_RAISECHECK_PC${playerCount || "UNKNOWN"}`;
}

function rowsByBucket(rows = []) {
  return new Map(rows.map((row) => [String(row.bucket ?? ""), row]));
}

function runWithHits(repeatability = {}, candidate = {}) {
  const playerCount = Number(candidate.playerCount ?? 0);
  const key = playerCount === 3 ? "playerCount3Hits" : "playerCount4Hits";
  return (repeatability.runs ?? []).find((run) => Number(run[key] ?? 0) > 0) ?? repeatability.runs?.[0] ?? {};
}

export function buildReplayReference({ candidate = {}, row = {}, repeatability = {} } = {}) {
  const run = runWithHits(repeatability, candidate);
  const playerCount = Number(candidate.playerCount ?? row.playerCount ?? row.metadata?.playerCount ?? 0);
  const hitCount = playerCount === 3 ? Number(run.playerCount3Hits ?? 0) : Number(run.playerCount4Hits ?? 0);
  return {
    runId: run.run ? `step46-run${run.run}` : "step46",
    arenaId: run.arenaId ?? null,
    seed: row.metadata?.seed ?? null,
    handId: row.metadata?.handId ?? null,
    decisionIndex: row.metadata?.step ?? null,
    actionIndex: row.metadata?.step ?? null,
    bucket: candidate.bucket ?? row.bucket ?? null,
    playerCount,
    exactHitsInRun: hitCount,
    replayDeterministic: row.metadata?.replayDeterministic !== false && row.forcedReplay?.deterministicReplay !== false,
    referenceSource: "step37-forced-replay-source-with-step46-aggregate-hit",
  };
}

export function buildCoachingHandoffPackageSummary({
  candidates = [],
  preexportRows = [],
  repeatability = {},
} = {}) {
  const byBucket = rowsByBucket(preexportRows);
  const packages = candidates.map((candidate) => {
    const row = byBucket.get(candidate.bucket) ?? {};
    const forcedReplay = row.forcedReplay ?? {};
    const recommendedAction = actionType(row.chosenBestAction) || candidate.ironAction;
    const baselineAction = actionType(row.rejectedAction) || candidate.proAction;
    return {
      candidateId: candidateIdFor(candidate),
      variantId: candidate.variantId ?? row.variantId ?? "S02",
      spot: candidate.spot ?? row.bucketFamily ?? "deep RAISE-vs-CHECK",
      bucket: candidate.bucket ?? row.bucket ?? null,
      lessonTag: candidate.lessonTag ?? "missed-value",
      severity: Number(candidate.estimatedEVGain ?? forcedReplay.meanDelta ?? 0) >= 30 ? "medium" : "low",
      estimatedEVGain: roundNumber(candidate.estimatedEVGain ?? forcedReplay.meanDelta, 4),
      recommendedAction,
      baselineAction,
      playerCount: Number(candidate.playerCount ?? row.playerCount ?? row.metadata?.playerCount ?? 0),
      exactHits: Number(candidate.exactHits ?? 0),
      exactOpportunities: Number(candidate.exactOpportunities ?? 0),
      forcedReplay: {
        sampleCount: Number(forcedReplay.sampleCount ?? 0),
        meanDelta: roundNumber(forcedReplay.meanDelta, 4),
        signFlipRate: roundNumber(forcedReplay.signFlipRate, 4),
        confidence: roundNumber(forcedReplay.confidence, 4),
        invalidReplayCount: Number(forcedReplay.invalidReplayCount ?? 0),
        deterministicReplay: forcedReplay.deterministicReplay !== false,
      },
      replayReference: buildReplayReference({ candidate, row, repeatability }),
      governance: {
        promoted: false,
        routingChanged: false,
        priorityFrozen: true,
        d01Excluded: true,
        datasetMutation: false,
        productionMutation: false,
      },
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: "step46-coaching-material-candidates",
    packageType: "coaching-rl-handoff-preview",
    candidateCount: packages.length,
    candidates: packages,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
    productionDatasetOverwrite: false,
  };
}

export async function buildCoachingHandoffPackage({
  candidatesPath = STEP47_CANDIDATES_PATH,
  preexportRowsPath = STEP47_PREEXPORT_ROWS_PATH,
  repeatabilityPath = STEP47_REPEATABILITY_PATH,
  outputPath = DEFAULT_STEP47_COACHING_HANDOFF_OUTPUT_PATH,
  candidates = null,
  preexportRows = null,
  repeatability = null,
} = {}) {
  const report = buildCoachingHandoffPackageSummary({
    candidates: candidates ?? (await readJsonl(candidatesPath)),
    preexportRows: preexportRows ?? (await readPreExportRows(preexportRowsPath)),
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingHandoffPackage();
  console.log(JSON.stringify(report, null, 2));
}
