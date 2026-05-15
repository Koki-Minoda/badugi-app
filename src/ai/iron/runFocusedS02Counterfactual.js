import path from "node:path";

import {
  actionName,
  auditSampleLegalityAndRepair,
  buildObservationRows,
  loadFocusedS02Samples,
  sampleAxisValue,
  summarizeObservationRows,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-counterfactual-step28.json",
);

async function withSuppressedDeckLogs(callback) {
  const originalLog = console.log;
  console.log = (...args) => {
    const first = String(args[0] ?? "");
    if (first.includes("[DECK][STATE]")) return;
    originalLog(...args);
  };
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

export async function runFocusedS02Counterfactual({
  samples = null,
  replayResults = null,
  maxSamples = 60,
  rolloutSeeds = [1],
  runReplay = true,
} = {}) {
  const focusedSamples = samples ?? (replayResults?.map((entry) => entry.sample).filter(Boolean) ?? null) ?? (await loadFocusedS02Samples({ maxSamples }));
  const selectedSamples = focusedSamples.slice(0, maxSamples);
  let rows = replayResults ? buildObservationRows({ samples: selectedSamples, replayResults }) : [];

  if (!rows.length && runReplay) {
    const { replayDivergenceAction } = await import("../evaluation/replayDivergenceAction.js");
    rows = await withSuppressedDeckLogs(async () => {
      const output = [];
      for (const sample of selectedSamples) {
        const legality = auditSampleLegalityAndRepair(sample);
        if (legality.invalidReplay) {
          output.push({
            sample,
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            standardAction: actionName(sample.standardAction),
            proAction: actionName(sample.proAction),
            standardEv: null,
            proEv: null,
            delta: 0,
            ok: false,
            legality,
            fallbackPolicy: "pro",
            fallbackAction: actionName(sample.proAction),
          });
          continue;
        }
        const [proReplay, standardReplay] = await Promise.all([
          replayDivergenceAction({ sample, action: sample.proAction, rolloutPolicy: "pro", rolloutSeeds }),
          replayDivergenceAction({ sample, action: sample.standardAction, rolloutPolicy: "pro", rolloutSeeds }),
        ]);
        const ok = Boolean(proReplay.ok && standardReplay.ok);
        output.push({
          sample,
          seed: sample.seed,
          handId: sample.handId,
          step: sample.step,
          standardAction: actionName(sample.standardAction),
          proAction: actionName(sample.proAction),
          standardEv: standardReplay.ev,
          proEv: proReplay.ev,
          delta: ok ? Number(standardReplay.ev ?? 0) - Number(proReplay.ev ?? 0) : 0,
          ok,
          legality: ok ? legality : { ...legality, invalidReplay: true, legalActionMismatch: true },
          replayErrors: [...(proReplay.errors ?? []), ...(standardReplay.errors ?? [])],
          fallbackPolicy: "pro",
          fallbackAction: actionName(sample.proAction),
        });
      }
      return output;
    });
  }

  if (!rows.length) rows = buildObservationRows({ samples: selectedSamples });
  const summary = summarizeObservationRows(rows);
  const actualCounterfactualReplay = Boolean(replayResults?.length) || Boolean(runReplay);
  const verdict =
    !actualCounterfactualReplay
      ? "COUNTERFACTUAL_ONLY"
      : summary.invalidReplayCount > 0
      ? "COUNTERFACTUAL_ONLY"
      : summary.sampleCount >= 30 &&
          summary.confidence >= 0.75 &&
          summary.repairRate <= 0.1 &&
          summary.signFlipRate <= 0.1 &&
          summary.entropyScore <= 0.35 &&
          summary.meanDelta > 0
        ? "EXPORTABLE_CANDIDATE"
        : "COUNTERFACTUAL_ONLY";

  return {
    generatedAt: new Date().toISOString(),
    bucket: summary.bucket,
    sampleCount: summary.sampleCount,
    meanDelta: summary.meanDelta,
    confidence: summary.confidence,
    actualCounterfactualReplay,
    evSource: actualCounterfactualReplay ? "forced-action-replay" : "replay-sample-action-proxy",
    signFlipRate: summary.signFlipRate,
    entropyScore: summary.entropyScore,
    repairRate: summary.repairRate,
    invalidReplayCount: summary.invalidReplayCount,
    legalActionMismatch: summary.legalActionMismatch,
    fallbackDistribution: summary.fallbackDistribution,
    deterministicReplay: summary.deterministicReplay,
    verdict,
    observations: rows.map((row) => ({
      seed: row.seed,
      handId: row.handId,
      step: row.step,
      playerCount: row.sample?.playerCount ?? null,
      position: row.sample?.position ?? null,
      drawRound: row.sample?.drawRound ?? null,
      bettingRound: row.sample?.bettingRound ?? null,
      callBand: row.sample ? sampleAxisValue(row.sample, "callBand") : null,
      pressureFamily: row.sample ? sampleAxisValue(row.sample, "pressureFamily") : null,
      pressureChain: row.sample ? sampleAxisValue(row.sample, "pressureChain") : null,
      stackDepth: row.sample ? sampleAxisValue(row.sample, "stackDepth") : null,
      handClassStrength: row.sample ? sampleAxisValue(row.sample, "handClassStrength") : null,
      toCallRatio: row.sample ? sampleAxisValue(row.sample, "toCallRatio") : null,
      potOddsBand: row.sample ? sampleAxisValue(row.sample, "potOddsBand") : null,
      standardAction: row.standardAction,
      proAction: row.proAction,
      standardEv: row.standardEv,
      proEv: row.proEv,
      delta: row.delta,
      ok: row.ok,
      repairRequired: Boolean(row.legality?.repairRequired),
      repairType: row.legality?.repairType ?? null,
    })),
    outputPath: DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH,
  };
}

export async function writeFocusedS02Counterfactual({
  outputPath = DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH,
  ...input
} = {}) {
  const report = await runFocusedS02Counterfactual(input);
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeFocusedS02Counterfactual({ runReplay: process.argv.includes("--run-replay") });
  console.log(JSON.stringify(report, null, 2));
}
