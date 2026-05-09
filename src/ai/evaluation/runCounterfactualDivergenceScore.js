import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_EVAL_DIVERGENCE_REPLAY_DIR,
  AI_EVAL_REPORT_DIR,
} from "./runAiEvaluationBatch.js";
import {
  bucketForReplaySample,
  matchesReplayBucketFilter,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";
import { replayDivergenceAction } from "./replayDivergenceAction.js";

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
  };
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
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
  for (const { entry } of chosenEntries.values()) {
    const content = await fs.readFile(path.join(AI_EVAL_DIVERGENCE_REPLAY_DIR, entry), "utf8");
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const sample = JSON.parse(line);
        if (shouldKeepReplaySample(sample) && matchesReplayBucketFilter(sample, bucketFilter)) {
          samples.push(sample);
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

export async function runCounterfactualDivergenceScore({
  variants = ["S02", "S01", "D02"],
  maxSamples = 500,
  bucketFilter = [],
  sampleTagFilter = [],
  rolloutSeeds = [1, 2, 3],
} = {}) {
  const candidates = await readReplaySamples(variants, bucketFilter, sampleTagFilter);
  const deduped = [];
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
    deduped.push(sample);
    if (deduped.length >= maxSamples) break;
  }

  const grouped = new Map();
  let validReplays = 0;
  let invalidReplays = 0;

  for (const sample of deduped) {
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

    if (proReplay.ok) validReplays += 1;
    else invalidReplays += 1;
    if (standardReplay.ok) validReplays += 1;
    else invalidReplays += 1;

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
      aggregate.invalidReplayCount += 1;
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
    replaySamples: deduped.length,
    validReplays,
    invalidReplays,
    bucketResults,
  };

  const tagSuffix = sampleTagFilter.length
    ? `-${sampleTagFilter.map((tag) => String(tag).toLowerCase()).join("-")}`
    : "";
  const outputPath = path.join(
    AI_EVAL_REPORT_DIR,
    `counterfactual-score-${variants.map((variant) => variant.toLowerCase()).join("-")}${tagSuffix}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return { report, outputPath };
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
