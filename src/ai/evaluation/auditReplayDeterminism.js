import fs from "node:fs/promises";
import path from "node:path";

import { AI_EVAL_DIVERGENCE_REPLAY_DIR, AI_EVAL_REPORT_DIR } from "./runAiEvaluationBatch.js";
import {
  bucketForReplaySample,
  matchesReplayBucketFilter,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";
import { isReplayActionStillLegal, replayDivergenceAction } from "./replayDivergenceAction.js";
import { clone, createControllerForVariant } from "./runAiEvaluationBatch.js";

const DEFAULT_OUTPUT_PATH = path.join(AI_EVAL_REPORT_DIR, "replay-determinism-audit-step3.json");

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
        : ["D02", "S01", "S02"],
    sampleTagFilter:
      typeof options["corpus-tag"] === "string" && options["corpus-tag"].trim().length
        ? options["corpus-tag"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    bucketFilter:
      typeof options["bucket-filter"] === "string" && options["bucket-filter"].trim().length
        ? options["bucket-filter"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    maxSamples: Number(options["max-samples"] ?? 500),
    repeats: Number(options.repeats ?? 3),
  };
}

function resolveEffectiveSampleTagFilter(sampleTagFilter = []) {
  const normalized = sampleTagFilter.map((entry) => String(entry).toLowerCase());
  if (normalized.includes("iron-step16")) return ["iron-step5", "iron-step6"];
  if (normalized.includes("iron-step39") || normalized.includes("iron-step40")) return ["iron-step5", "iron-step6"];
  if (normalized.includes("iron-step14") || normalized.includes("iron-step15")) return ["iron-step5", "iron-step6"];
  if (normalized.includes("iron-step13")) return ["iron-step5", "iron-step6"];
  if (normalized.includes("iron-step12")) return ["iron-step5", "iron-step6"];
  if (normalized.includes("iron-step11")) return ["iron-step5", "iron-step6"];
  return sampleTagFilter;
}

function resolveEffectiveVariants(variants = [], sampleTagFilter = []) {
  const normalized = sampleTagFilter.map((entry) => String(entry).toLowerCase());
  if (normalized.includes("iron-step16")) return ["S02"];
  if (normalized.includes("iron-step39") || normalized.includes("iron-step40")) return ["S02"];
  if (normalized.includes("iron-step14") || normalized.includes("iron-step15")) return ["S02"];
  if (normalized.includes("iron-step13")) return ["S02"];
  if (normalized.includes("iron-step12") || normalized.includes("iron-step11")) return ["S02"];
  return variants;
}

async function readReplaySamples(variants = [], sampleTagFilter = [], bucketFilter = [], maxSamples = 500) {
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
        let sample = null;
        try {
          sample = JSON.parse(line);
        } catch {
          return;
        }
        if (shouldKeepReplaySample(sample) && matchesReplayBucketFilter(sample, bucketFilter)) {
          samples.push(sample);
        }
      });
  }
  return samples.slice(0, Math.max(1, maxSamples));
}

export async function auditReplayDeterminism({
  variants = ["D02", "S01", "S02"],
  sampleTagFilter = [],
  bucketFilter = [],
  maxSamples = 500,
  repeats = 3,
  outputPath = null,
} = {}) {
  const effectiveSampleTagFilter = resolveEffectiveSampleTagFilter(sampleTagFilter);
  const effectiveVariants = resolveEffectiveVariants(variants, sampleTagFilter);
  const samples = await readReplaySamples(effectiveVariants, effectiveSampleTagFilter, bucketFilter, maxSamples);
  const mismatches = [];
  const invalidReplays = [];
  const excludedInvalidSamples = [];
  const hashMismatchBuckets = new Map();

  for (const sample of samples) {
    const controller = createControllerForVariant(
      sample.variantId,
      Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
    );
    const legality = controller
      ? isReplayActionStillLegal({
          controller,
          state: clone(sample.state),
          actorSeat: sample.actorSeat,
          action: sample.proAction,
        })
      : { ok: false, reason: "STATE_RESTORE_ERROR", restoredLegalActions: [] };
    if (!legality.ok) {
      excludedInvalidSamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        bucket: bucketForReplaySample(sample),
        invalidReason: legality.reason ?? "LEGAL_ACTION_MISMATCH",
      });
      continue;
    }
    const runs = [];
    for (let index = 0; index < Math.max(2, repeats); index += 1) {
      const replay = await replayDivergenceAction({
        sample,
        action: sample.proAction,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      runs.push(replay);
    }
    const invalid = runs.filter((run) => !run.ok);
    if (invalid.length) {
      const excluded = invalid.every((run) =>
        ["LEGAL_ACTION_MISMATCH", "INVALID_ACTION"].includes(String(run?.invalidReason ?? "").toUpperCase()),
      );
      if (excluded) {
        excludedInvalidSamples.push({
          variantId: sample.variantId,
          seed: sample.seed,
          handId: sample.handId,
          step: sample.step,
          bucket: bucketForReplaySample(sample),
          invalidReason: invalid[0]?.invalidReason ?? "UNKNOWN",
        });
        continue;
      }
      invalidReplays.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        bucket: bucketForReplaySample(sample),
        invalidReason: invalid[0]?.invalidReason ?? "UNKNOWN",
        errors: invalid.map((run) => run.errors ?? []),
      });
      continue;
    }
    const baseline = runs[0];
    const bucket = bucketForReplaySample(sample);
    const consistent = runs.every(
      (run) =>
        run.ev === baseline.ev &&
        run.actionHash === baseline.actionHash &&
        run.initialStateHash === baseline.initialStateHash &&
        run.traceHash === baseline.traceHash,
    );
    if (!consistent) {
      mismatches.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        bucket,
        baseline: {
          ev: baseline.ev,
          initialStateHash: baseline.initialStateHash,
          actionHash: baseline.actionHash,
          traceHash: baseline.traceHash,
        },
        runs: runs.map((run) => ({
          ev: run.ev,
          initialStateHash: run.initialStateHash,
          actionHash: run.actionHash,
          traceHash: run.traceHash,
        })),
      });
      hashMismatchBuckets.set(bucket, (hashMismatchBuckets.get(bucket) ?? 0) + 1);
    }
  }

  const resolvedOutputPath =
    outputPath ??
    path.join(
      AI_EVAL_REPORT_DIR,
      `replay-determinism-audit-${sampleTagFilter.length ? sampleTagFilter.join("-").toLowerCase() : "step3"}.json`,
    );

  const report = {
    createdAt: new Date().toISOString(),
    variants: effectiveVariants,
    sampleTagFilter,
    effectiveSampleTagFilter,
    replaySamples: samples.length,
    repeats: Math.max(2, repeats),
    deterministic: mismatches.length === 0 && invalidReplays.length === 0,
    mismatchCount: mismatches.length,
    invalidReplayCount: invalidReplays.length,
    excludedInvalidSamples: excludedInvalidSamples.length,
    hashMismatchBuckets: Object.fromEntries(hashMismatchBuckets),
    mismatches,
    invalidReplays,
    excludedInvalidSampleDetails: excludedInvalidSamples,
  };

  await fs.writeFile(resolvedOutputPath, JSON.stringify(report, null, 2), "utf8");
  return { report, outputPath: resolvedOutputPath };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { report, outputPath } = await auditReplayDeterminism(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ outputPath, ...report }, null, 2));
}
