import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_EVAL_DIVERGENCE_REPLAY_DIR,
  AI_EVAL_REPORT_DIR,
  clone,
  createControllerForVariant,
} from "./runAiEvaluationBatch.js";
import {
  bucketForReplaySample,
  matchesReplayBucketFilter,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";
import { isReplayActionStillLegal, replayDivergenceAction } from "./replayDivergenceAction.js";
import { writeBucketEntropyReport } from "./analyzeBucketEntropy.js";
import {
  verifyS02NeighborV2Expansion,
  verifyS02NeighborV3Expansion,
  verifyS02NeighborV3WithRepair,
  verifyS02RelaxedMatch,
  verifyS02V3Isolation,
  verifyStableNeighborBuckets,
} from "./verifyStableNeighborBuckets.js";

const COUNTERFACTUAL_BUCKET_PRIORITY = {
  "iron-step5": {
    S01: ["strongSD27 top-end pressure", "upperMediumSD27 small-pressure"],
    D01: ["premium27TD late pressure", "strong27TD late pressure", "medium27TD pressure"],
    S02: ["strongSDA5 CALL/FOLD/RAISE", "premiumSDA5 CALL/RAISE"],
    D02: ["strongA5 second-pressure", "premiumA5 value spots", "mediumA5 small-pressure"],
  },
  "iron-step6": {
    D01: ["premium27TD late pressure", "strong27TD late pressure", "medium27TD pressure"],
    S01: ["strongSD27 top-end pressure", "upperMediumSD27 small-pressure"],
    S02: ["strongSDA5 CALL/FOLD/RAISE", "premiumSDA5 CALL/RAISE"],
    D02: ["strongA5 second-pressure", "premiumA5 value spots", "mediumA5 small-pressure"],
  },
  "iron-step7": {
    D01: ["premium27TD late pressure", "strong27TD late pressure", "medium27TD pressure"],
  },
};

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    variants:
      typeof options.variants === "string" && options.variants.trim().length
        ? options.variants.split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean)
        : ["S02", "S01", "D02"],
    maxSamples: Number(options["max-samples"] ?? 500),
    bucketFilter:
      typeof options["bucket-filter"] === "string" && options["bucket-filter"].trim().length
        ? options["bucket-filter"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    sampleTagFilter:
      typeof options["corpus-tag"] === "string" && options["corpus-tag"].trim().length
        ? options["corpus-tag"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : typeof options["sample-tag-filter"] === "string" && options["sample-tag-filter"].trim().length
          ? options["sample-tag-filter"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    rolloutSeeds:
      typeof options["rollout-seeds"] === "string" && options["rollout-seeds"].trim().length
        ? options["rollout-seeds"].split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite)
        : [1, 2, 3],
    neighborFocus:
      typeof options["neighbor-focus"] === "string" && options["neighbor-focus"].trim().length
        ? options["neighbor-focus"].trim().toUpperCase()
        : null,
  };
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function getTagSuffix(sampleTagFilter = []) {
  return sampleTagFilter.length
    ? `-${sampleTagFilter.map((tag) => String(tag).toLowerCase()).join("-")}`
    : "";
}

function getBucketPriority(sampleTagFilter = []) {
  const firstTag = String(sampleTagFilter?.[0] ?? "").toLowerCase();
  return COUNTERFACTUAL_BUCKET_PRIORITY[firstTag] ?? {};
}

function buildBucketKey(sample = {}) {
  return [
    sample.variantId,
    bucketForReplaySample(sample),
    sample.proAction?.type,
    sample.standardAction?.type,
  ].join("|");
}

function aggregateVerdict({
  sampleCount = 0,
  validReplayCount = 0,
  invalidReplayCount = 0,
  meanDelta = 0,
  positiveRate = 0,
  negativeRate = 0,
  stdDev = 0,
  stabilityAcrossSeeds = 0,
}) {
  if (validReplayCount === 0 && invalidReplayCount > 0) return "INVALID_REPLAY";
  if (sampleCount < 5) return "NEEDS_MORE_SAMPLES";
  const signStability = Math.max(positiveRate, negativeRate);
  if (sampleCount >= 30 && signStability >= 0.7 && Math.abs(meanDelta) >= 10 && stabilityAcrossSeeds >= 0.67) {
    return meanDelta < 0 ? "STABLE_STANDARD_BETTER" : "STABLE_PRO_BETTER";
  }
  if (sampleCount >= 5 && (signStability < 0.6 || stdDev > Math.max(10, Math.abs(meanDelta) * 1.5))) {
    return "NOISY";
  }
  if (Math.abs(meanDelta) < 5) return "NO_CLEAR_EDGE";
  return "NEEDS_MORE_SAMPLES";
}

async function readReplaySamples(variants = [], bucketFilter = [], sampleTagFilter = []) {
  const entries = await fs.readdir(AI_EVAL_DIVERGENCE_REPLAY_DIR).catch(() => []);
  const wanted = new Set(variants.map((variant) => variant.toLowerCase()));
  const wantedTags = new Set(sampleTagFilter.map((tag) => String(tag).toLowerCase()).filter(Boolean));
  const chosenEntries = new Map();

  for (const entry of entries) {
    const parsed = parseReplaySampleFilename(entry);
    if (!parsed) continue;
    if (!wanted.has(parsed.variant.toLowerCase())) continue;
    if (wantedTags.size && !wantedTags.has(String(parsed.tag).toLowerCase())) continue;
    const key = `${parsed.variant}:${parsed.seed}`;
    const current = chosenEntries.get(key);
    if (!current || replaySampleTagPriority(parsed.tag) > replaySampleTagPriority(current.tag)) {
      chosenEntries.set(key, { entry, ...parsed });
    }
  }

  const samples = [];
  for (const { entry, tag } of chosenEntries.values()) {
    const content = await fs.readFile(path.join(AI_EVAL_DIVERGENCE_REPLAY_DIR, entry), "utf8");
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        let sample = null;
        try {
          sample = JSON.parse(line);
        } catch {
          return;
        }
        const taggedSample = { ...sample, sampleTag: tag };
        if (shouldKeepReplaySample(taggedSample) && matchesReplayBucketFilter(taggedSample, bucketFilter)) {
          samples.push(taggedSample);
        }
      });
  }
  return samples;
}

function summarizeBucket(aggregate) {
  const proEv = aggregate.validReplayCount ? aggregate.proEvTotal / aggregate.validReplayCount : null;
  const stdEv = aggregate.validReplayCount ? aggregate.stdEvTotal / aggregate.validReplayCount : null;
  const meanDelta = typeof proEv === "number" && typeof stdEv === "number" ? round(proEv - stdEv, 2) : null;
  const sorted = [...aggregate.deltas].sort((left, right) => left - right);
  const medianDelta = sorted.length
    ? sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : round((sorted[sorted.length / 2] + sorted[sorted.length / 2 - 1]) / 2, 2)
    : null;
  const variance = aggregate.deltas.length
    ? aggregate.deltas.reduce((sum, value) => sum + (value - (meanDelta ?? 0)) ** 2, 0) / aggregate.deltas.length
    : 0;
  const stdDev = round(Math.sqrt(variance), 2);
  const positiveRate = aggregate.deltas.length
    ? round(aggregate.deltas.filter((value) => value > 0).length / aggregate.deltas.length, 4)
    : 0;
  const negativeRate = aggregate.deltas.length
    ? round(aggregate.deltas.filter((value) => value < 0).length / aggregate.deltas.length, 4)
    : 0;
  const dominantSign = negativeRate > positiveRate ? -1 : positiveRate > negativeRate ? 1 : 0;
  const seedSigns = [...aggregate.seedDeltas.values()].map((values) => {
    const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    return avg > 0 ? 1 : avg < 0 ? -1 : 0;
  });
  const stabilityAcrossSeeds = seedSigns.length
    ? round(seedSigns.filter((sign) => sign === dominantSign && sign !== 0).length / seedSigns.length, 4)
    : 0;
  const confidence = round(
    Math.min(
      1,
      (aggregate.validReplayCount / 30) * Math.max(positiveRate, negativeRate) * Math.max(stabilityAcrossSeeds, 0.34),
    ),
    4,
  );

  return {
    variant: aggregate.variantId,
    bucket: aggregate.bucket,
    proAction: aggregate.proAction,
    stdAction: aggregate.stdAction,
    proEv,
    stdEv,
    meanDelta,
    medianDelta,
    stdDev,
    positiveRate,
    negativeRate,
    confidence,
    stabilityAcrossSeeds,
    replayConsistencyScore: stabilityAcrossSeeds,
    replayDeterministic: aggregate.invalidReplayCount === 0,
    legalityValidated: aggregate.invalidReplayCount === 0,
    sampleCount: aggregate.sampleCount,
    validReplayCount: aggregate.validReplayCount,
    invalidReplayCount: aggregate.invalidReplayCount,
    verdict: aggregateVerdict({
      sampleCount: aggregate.sampleCount,
      validReplayCount: aggregate.validReplayCount,
      invalidReplayCount: aggregate.invalidReplayCount,
      meanDelta: meanDelta ?? 0,
      positiveRate,
      negativeRate,
      stdDev,
      stabilityAcrossSeeds,
    }),
  };
}

function isExcludedLegalityMismatch(replay = {}) {
  return ["LEGAL_ACTION_MISMATCH", "INVALID_ACTION"].includes(String(replay?.invalidReason ?? "").toUpperCase());
}

function prevalidateReplaySample(sample = {}, action = null) {
  const controller = createControllerForVariant(
    sample.variantId,
    Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
  );
  if (!controller) {
    return {
      ok: false,
      reason: "STATE_RESTORE_ERROR",
      restoredLegalActions: [],
    };
  }
  const state = clone(sample.state);
  return isReplayActionStillLegal({
    controller,
    state,
    actorSeat: sample.actorSeat,
    action,
  });
}

export async function runCounterfactualDivergenceScore({
  variants = ["S02", "S01", "D02"],
  maxSamples = 500,
  bucketFilter = [],
  sampleTagFilter = [],
  rolloutSeeds = [1, 2, 3],
  neighborFocus = null,
} = {}) {
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step10")) {
    const { counterfactual, counterfactualOutputPath } = await verifyStableNeighborBuckets({
      variants,
      maxSamples,
    });
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step11")) {
    const { counterfactual, counterfactualOutputPath } = await verifyS02NeighborV2Expansion({
      maxSamples,
    });
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step12")) {
    const { counterfactual, counterfactualOutputPath } = await verifyS02NeighborV3Expansion({
      maxSamples,
    });
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step13")) {
    const { counterfactual, counterfactualOutputPath } = await verifyS02NeighborV3WithRepair({
      maxSamples,
    });
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step14")) {
    const { counterfactual, counterfactualOutputPath } = await verifyS02V3Isolation({
      maxSamples,
    });
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  if (sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step15")) {
    const { counterfactual, counterfactualOutputPath } = await verifyS02RelaxedMatch();
    return {
      report: counterfactual,
      outputPath: counterfactualOutputPath,
    };
  }
  let candidates = await readReplaySamples(variants, bucketFilter, sampleTagFilter);
  if (
    sampleTagFilter.map((entry) => String(entry).toLowerCase()).includes("iron-step17") &&
    String(neighborFocus ?? "").toUpperCase() === "S02_RELAXED_V3"
  ) {
    candidates = candidates.filter(
      (sample) =>
        String(sample.variantId ?? "").toUpperCase() === "S02" &&
        String(sample.handClass ?? "") === "strongSDA5" &&
        Number(sample.playerCount ?? 0) === 3 &&
        String(sample.position ?? "").toLowerCase() !== "blind",
    );
  }
  const bucketPriority = getBucketPriority(sampleTagFilter);
  const dedupedByVariant = new Map();
  const seen = new Set();
  for (const sample of candidates) {
    const key = [
      sample.variantId,
      bucketForReplaySample(sample),
      sample.seed,
      sample.handId,
      sample.step,
      sample.proAction?.type,
      sample.standardAction?.type,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (!dedupedByVariant.has(sample.variantId)) dedupedByVariant.set(sample.variantId, []);
    dedupedByVariant.get(sample.variantId).push(sample);
  }

  for (const [variant, queue] of dedupedByVariant.entries()) {
    const preferredBuckets = bucketPriority[variant] ?? [];
    if (!preferredBuckets.length) continue;
    queue.sort((left, right) => {
      const leftIndex = preferredBuckets.indexOf(bucketForReplaySample(left));
      const rightIndex = preferredBuckets.indexOf(bucketForReplaySample(right));
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight;
    });
  }

  const deduped = [];
  const variantQueues = variants
    .map((variant) => [variant, [...(dedupedByVariant.get(variant) ?? [])]])
    .filter(([, queue]) => queue.length > 0);
  while (deduped.length < maxSamples && variantQueues.length > 0) {
    let emitted = false;
    for (let index = 0; index < variantQueues.length && deduped.length < maxSamples; index += 1) {
      const [, queue] = variantQueues[index];
      if (!queue.length) continue;
      deduped.push(queue.shift());
      emitted = true;
    }
    for (let index = variantQueues.length - 1; index >= 0; index -= 1) {
      if (variantQueues[index][1].length === 0) variantQueues.splice(index, 1);
    }
    if (!emitted) break;
  }

  const grouped = new Map();
  let validReplays = 0;
  let invalidReplays = 0;
  const invalidReplaySamples = [];
  const replayReadySamples = [];

  for (const sample of deduped) {
    const proLegality = prevalidateReplaySample(sample, sample.proAction);
    if (!proLegality.ok) {
      invalidReplaySamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        bucket: bucketForReplaySample(sample),
        replayedAction: sample.proAction?.type ?? null,
        sourcePolicy: "pro",
        invalidReason: proLegality.reason ?? "LEGAL_ACTION_MISMATCH",
        errors: ["pre-replay-legality-reject"],
        legalityValidated: false,
        restoredLegalActions: proLegality.restoredLegalActions ?? [],
        legalActions: sample.legalActions ?? [],
      });
      continue;
    }
    const standardLegality = prevalidateReplaySample(sample, sample.standardAction);
    if (!standardLegality.ok) {
      invalidReplaySamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        bucket: bucketForReplaySample(sample),
        replayedAction: sample.standardAction?.type ?? null,
        sourcePolicy: "standard",
        invalidReason: standardLegality.reason ?? "LEGAL_ACTION_MISMATCH",
        errors: ["pre-replay-legality-reject"],
        legalityValidated: false,
        restoredLegalActions: standardLegality.restoredLegalActions ?? [],
        legalActions: sample.legalActions ?? [],
      });
      continue;
    }
    replayReadySamples.push(sample);
  }

  for (const sample of replayReadySamples) {
    const proReplay = await replayDivergenceAction({
      sample,
      action: sample.proAction,
      rolloutPolicy: "pro",
      rolloutSeeds,
    });
    const standardReplay = await replayDivergenceAction({
      sample,
      action: sample.standardAction,
      rolloutPolicy: "pro",
      rolloutSeeds,
    });

    const excludedProMismatch = !proReplay.ok && isExcludedLegalityMismatch(proReplay);
    if (proReplay.ok) validReplays += 1;
    else {
      if (!excludedProMismatch) invalidReplays += 1;
      invalidReplaySamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        bucket: bucketForReplaySample(sample),
        replayedAction: sample.proAction?.type ?? null,
        sourcePolicy: "pro",
        invalidReason: proReplay.invalidReason ?? "UNKNOWN",
        errors: proReplay.errors ?? [],
        initialStateHash: proReplay.initialStateHash ?? null,
        terminalStateHash: proReplay.terminalStateHash ?? null,
        actionHash: proReplay.actionHash ?? null,
        traceHash: proReplay.traceHash ?? null,
        legalityValidated: Boolean(proReplay.legalityValidated),
        restoredLegalActions: proReplay.restoredLegalActions ?? [],
        legalActions: sample.legalActions ?? [],
      });
    }
    const excludedStandardMismatch = !standardReplay.ok && isExcludedLegalityMismatch(standardReplay);
    if (standardReplay.ok) validReplays += 1;
    else {
      if (!excludedStandardMismatch) invalidReplays += 1;
      invalidReplaySamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        bucket: bucketForReplaySample(sample),
        replayedAction: sample.standardAction?.type ?? null,
        sourcePolicy: "standard",
        invalidReason: standardReplay.invalidReason ?? "UNKNOWN",
        errors: standardReplay.errors ?? [],
        initialStateHash: standardReplay.initialStateHash ?? null,
        terminalStateHash: standardReplay.terminalStateHash ?? null,
        actionHash: standardReplay.actionHash ?? null,
        traceHash: standardReplay.traceHash ?? null,
        legalityValidated: Boolean(standardReplay.legalityValidated),
        restoredLegalActions: standardReplay.restoredLegalActions ?? [],
        legalActions: sample.legalActions ?? [],
      });
    }

    const key = buildBucketKey(sample);
    if (!grouped.has(key)) {
      grouped.set(key, {
        variantId: sample.variantId,
        bucket: bucketForReplaySample(sample),
        proAction: sample.proAction?.type ?? null,
        stdAction: sample.standardAction?.type ?? null,
        sampleCount: 0,
        validReplayCount: 0,
        invalidReplayCount: 0,
        proEvTotal: 0,
        stdEvTotal: 0,
        deltas: [],
        seedDeltas: new Map(),
      });
    }

    const aggregate = grouped.get(key);
    aggregate.sampleCount += 1;
    if (!proReplay.ok || !standardReplay.ok) {
      if (!excludedProMismatch && !excludedStandardMismatch) {
        aggregate.invalidReplayCount += 1;
      }
      continue;
    }

    const delta = round(proReplay.ev - standardReplay.ev, 2);
    aggregate.validReplayCount += 1;
    aggregate.proEvTotal += proReplay.ev;
    aggregate.stdEvTotal += standardReplay.ev;
    aggregate.deltas.push(delta);
    if (!aggregate.seedDeltas.has(sample.seed)) aggregate.seedDeltas.set(sample.seed, []);
    aggregate.seedDeltas.get(sample.seed).push(delta);
  }

  const bucketResults = [...grouped.values()]
    .map(summarizeBucket)
    .sort((left, right) => Math.abs(right.meanDelta ?? 0) - Math.abs(left.meanDelta ?? 0));

  const report = {
    createdAt: new Date().toISOString(),
    variants,
    sampleTagFilter,
    replaySamples: replayReadySamples.length,
    validReplays,
    invalidReplays,
    excludedInvalidSamples: invalidReplaySamples.length,
    replayDeterministic: invalidReplays === 0,
    bucketResults,
  };

  const tagSuffix = getTagSuffix(sampleTagFilter);
  const outputPath = path.join(
    AI_EVAL_REPORT_DIR,
    `counterfactual-score-${variants.map((variant) => variant.toLowerCase()).join("-")}${tagSuffix}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  if (variants.length === 1 && variants[0] === "D01" && sampleTagFilter.some((tag) => String(tag).toLowerCase() === "iron-step7")) {
    const isolatedPath = path.join(AI_EVAL_REPORT_DIR, "d01-isolated-counterfactual-step7.json");
    await fs.writeFile(isolatedPath, JSON.stringify(report, null, 2), "utf8");
    await writeBucketEntropyReport({
      samples: replayReadySamples.filter((sample) => sample.variantId === "D01"),
      bucketResults: bucketResults.filter((row) => row.variant === "D01"),
      outputPath: path.join(AI_EVAL_REPORT_DIR, "d01-bucket-entropy-step7.json"),
    });
  }
  if (invalidReplaySamples.length) {
    const invalidReplayReportPath = path.join(AI_EVAL_REPORT_DIR, `invalid-replay${tagSuffix || "-step3"}.json`);
    await fs.writeFile(
      invalidReplayReportPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sampleTagFilter,
          invalidReplayCount: invalidReplaySamples.length,
          invalidReplaySamples,
        },
        null,
        2,
      ),
      "utf8",
    );
    return { report, outputPath, invalidReplayReportPath };
  }
  return { report, outputPath, invalidReplayReportPath: null };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { report, outputPath } = await runCounterfactualDivergenceScore(parseArgs(process.argv.slice(2)));
  console.log(
    JSON.stringify(
      {
        outputPath,
        replaySamples: report.replaySamples,
        validReplays: report.validReplays,
        invalidReplays: report.invalidReplays,
        bucketResults: report.bucketResults,
      },
      null,
      2,
    ),
  );
}
