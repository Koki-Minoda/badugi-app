import fs from "node:fs/promises";
import path from "node:path";

import {
  buildDrawObservationPayload,
  buildDrawObservationVector,
  DRAW_OBSERVATION_VECTOR_SIZE,
} from "../../rl/drawObservationSchema.js";
import {
  bucketForReplaySample,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";
import {
  STEP10_SOURCE_TAGS,
  STEP10_STABLE_PARENT_BUCKETS,
  STEP14_S02_V3_PARENT_BUCKET,
  classifyStableNeighborContext,
  readNeighborSourceSamples,
} from "./discoverStableNeighborBuckets.js";
import { classifyS02V3IsolationAxes } from "./analyzeS02V3NoiseEntropy.js";

const DEFAULT_VARIANTS = ["D02", "S01", "S02"];
const AI_EVAL_DIVERGENCE_REPLAY_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");
const AI_EVAL_REPORT_DIR = path.resolve("reports/ai-eval");
const SPEC_OUTPUT_PATH = path.resolve("docs/ai/MGX_ACTION_VALUE_DATASET_SPEC.md");

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
        : DEFAULT_VARIANTS,
    sampleTag: String(options["corpus-tag"] ?? options["sample-tag"] ?? "step4y"),
    confidenceThreshold: Number(options["confidence-threshold"] ?? 0.7),
    datasetPath:
      typeof options.dataset === "string" && options.dataset.trim().length
        ? path.resolve(String(options.dataset))
        : null,
  };
}

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function isTrashOrWeakBucket(bucket = "") {
  const normalized = String(bucket).toLowerCase();
  return normalized.includes("trash") || normalized.includes("weak");
}

function keyForBucketResult(row = {}) {
  return [row.variant, row.bucket, row.proAction, row.stdAction].join("|");
}

function normalizeLegalActions(legalActions = []) {
  return (Array.isArray(legalActions) ? legalActions : [])
    .map((action) => (typeof action === "string" ? { type: action } : action))
    .filter((action) => actionType(action).length);
}

async function readTaggedSamples(variants = [], sampleTag = "step4y") {
  const entries = await fs.readdir(AI_EVAL_DIVERGENCE_REPLAY_DIR).catch(() => []);
  const wanted = new Set(variants.map((variant) => variant.toLowerCase()));
  const chosenEntries = new Map();
  for (const entry of entries) {
    const parsed = parseReplaySampleFilename(entry);
    if (!parsed) continue;
    if (!wanted.has(parsed.variant.toLowerCase())) continue;
    if (String(parsed.tag).toLowerCase() !== String(sampleTag).toLowerCase()) continue;
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
        if (!shouldKeepReplaySample(sample)) return;
        samples.push({ ...sample, sampleTag: tag });
      });
  }
  return samples;
}

async function readCounterfactualReport(variants = DEFAULT_VARIANTS, sampleTag = "step4y") {
  const files = await fs.readdir(AI_EVAL_REPORT_DIR).catch(() => []);
  const normalizedVariantSet = new Set(variants.map((variant) => variant.toLowerCase()));
  const candidates = files
    .filter((file) => file.startsWith("counterfactual-score-") && file.endsWith(".json"))
    .filter((file) => {
      const normalized = file.toLowerCase();
      return [...normalizedVariantSet].every((variant) => normalized.includes(variant));
    })
    .sort();
  if (!candidates.length) {
    throw new Error("No counterfactual score report found for action-value export");
  }
  let fallback = null;
  for (const target of candidates) {
    let report = null;
    try {
      report = JSON.parse(await fs.readFile(path.join(AI_EVAL_REPORT_DIR, target), "utf8"));
    } catch {
      continue;
    }
    const reportPath = path.join(AI_EVAL_REPORT_DIR, target);
    if (!fallback) fallback = { report, reportPath };
    const sampleTags = Array.isArray(report.sampleTagFilter)
      ? report.sampleTagFilter.map((entry) => String(entry).toLowerCase())
      : [];
    if (sampleTags.includes(String(sampleTag).toLowerCase())) {
      return { report, reportPath };
    }
  }
  if (fallback) return fallback;
  throw new Error("No parseable counterfactual score report found for action-value export");
}

function buildDatasetSpecMarkdown() {
  return `# MGX Action-value Dataset Spec

Schema goal:
- replay-backed action-value supervision for draw-family Pro / Iron bootstrap
- fixed observation shape for draw variants
- legal action preservation and bucket traceability

## Row Schema

\`\`\`json
{
  "variantId": "S02",
  "schemaVersion": 1,
  "observation": [],
  "legalActions": [],
  "candidateActions": [
    {
      "action": {},
      "source": "pro|standard|replay|counterfactual",
      "estimatedValue": 0,
      "sampleCount": 0,
      "confidence": 0,
      "verdict": "GOOD|BAD|NOISY"
    }
  ],
  "chosenBestAction": {},
  "handClass": "strongSDA5",
  "bucket": "strongSDA5-safe-pressure",
  "sourceCorpusTag": "iron-step2",
  "sourceCounterfactualScore": "reports/ai-eval/counterfactual-score-*.json",
  "trainingWeight": 0.84,
  "sourceType": "stable-bucket|verified-neighbor",
  "parentStableBucket": "strongA5 second-pressure",
  "neighborAxis": "repeatedPressure",
  "verificationConfidence": 0.97,
  "metadata": {}
}
\`\`\`

## Required Fields

| Field | Requirement |
| ----- | ----------- |
| \`schemaVersion\` | integer, currently \`1\` |
| \`variantId\` | one of draw-family replay-supported variants |
| \`observation\` | length \`96\`, finite numeric values |
| \`legalActions\` | preserved legal action list from replay sample |
| \`candidateActions\` | replay-backed action/value rows |
| \`chosenBestAction\` | legal action selected from candidate values |
| \`bucket\` | replay/counterfactual bucket label |
| \`sourceCorpusTag\` | corpus lineage tag such as \`step4y\` or \`iron-step2\` |
| \`sourceCounterfactualScore\` | source counterfactual score artifact path |
| \`trainingWeight\` | confidence/sample-count derived bootstrap weight |
| \`sourceType\` | \`stable-bucket\` or \`verified-neighbor\` |
| \`parentStableBucket\` | origin stable bucket when row is neighbor-backed |
| \`neighborAxis\` | single differing axis used for neighbor verification |
| \`verificationConfidence\` | replay-backed verification confidence |
| \`confidence\` | stored per candidate action |
| \`source\` | \`pro\`, \`standard\`, \`replay\`, or \`counterfactual\` |
| \`metadata\` | seed/hand/step/context and safety provenance |

## Filtering Rules

- include valid replay rows only
- exclude illegal replay actions
- require EV checker pass
- exclude \`NOISY\` buckets from training rows
- weak/trash buckets are excluded by default for bootstrap supervision
- keep bucket/source/confidence so training can down-weight or skip rows later

## Safety

- \`safetyVerdict\` must remain \`PASS\`
- rows with invalid or missing legal action alignment are rejected by the validator
- duplicate replay rows are rejected during validation
`;
}

async function readExistingDatasetRows(datasetPath) {
  const content = await fs.readFile(datasetPath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isStableStep10ParentRow(row = {}) {
  const bucket = String(row.bucket ?? "");
  return Object.values(STEP10_STABLE_PARENT_BUCKETS).some((entries) => entries.includes(bucket));
}

async function readStep10VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/counterfactual-score-d02-s01-s02-iron-step10.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

async function readStep11VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/s02-neighbor-verification-step11.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

async function readStep12VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/s02-neighbor-v3-verification-step12.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

async function readStep13VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/s02-v3-repaired-verification-step13.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

async function readStep14VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/s02-v3-isolation-verification-step14.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

async function readStep15VerificationReport() {
  const reportPath = path.resolve("reports/ai-eval/s02-relaxed-match-verification-step15.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return { report, reportPath };
}

export async function exportActionValueDataset({
  variants = DEFAULT_VARIANTS,
  sampleTag = "step4y",
  confidenceThreshold = 0.7,
  datasetPath = null,
} = {}) {
  if (String(sampleTag).toLowerCase() === "iron-step15") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step14-action-value.jsonl"))).map((row) => ({
      ...row,
      sourceCorpusTag: "iron-step15",
      metadata: {
        ...(row.metadata ?? {}),
        sampleTag: "iron-step15",
      },
    }));
    const { report, reportPath } = await readStep15VerificationReport();
    const samples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags: ["iron-step5", "iron-step6"] });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );

    for (const bucketResult of report.bucketResults ?? []) {
      if (String(bucketResult.verdict) !== "VERIFIED_RELAXED_MATCH") continue;
      const relaxedPressureChains = new Set(bucketResult.relaxedAxisValues?.pressureChain ?? []);
      const overrides = new Map(
        (bucketResult.exportableSamples ?? []).map((entry) => [
          [bucketResult.variant, entry.seed, entry.handId, entry.step, entry.actorSeat].join("|"),
          entry,
        ]),
      );
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        if (!classified || classified.subBucketId !== STEP14_S02_V3_PARENT_BUCKET || classified.variantId !== "S02") return false;
        const axes = classifyS02V3IsolationAxes(sample);
        return relaxedPressureChains.has(String(axes?.pressureChain ?? ""));
      });
      for (const sample of matchingSamples) {
        const sampleOverride = overrides.get([sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|"));
        if (!sampleOverride) continue;
        const legalActions = normalizeLegalActions(sample.legalActions);
        const chosenAction = sampleOverride.chosenAction;
        if (!legalActions.some((entry) => actionType(entry) === actionType(chosenAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(chosenAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions: [
            {
              action: proAction,
              source: "pro",
              estimatedValue: bucketResult.proEv ?? bucketResult.meanDelta,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "BAD",
            },
            {
              action: chosenAction,
              source: "counterfactual",
              estimatedValue: bucketResult.stdEv ?? 0,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "GOOD",
            },
          ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action))),
          chosenBestAction: chosenAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step15",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType: "verified-relaxed-match",
          parentStableBucket: bucketResult.parentStableBucket,
          parentIsolatedBucket: bucketResult.parentIsolatedBucket,
          relaxedAxes: bucketResult.relaxedAxes,
          relaxedAxisValues: bucketResult.relaxedAxisValues,
          entropyScore: Number(bucketResult.entropyScore ?? 0),
          repairRate: Number(bucketResult.repairRate ?? 0),
          acceptedInvalidReplayCount: 0,
          rawInvalidReplayCount: 0,
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step15",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType: "verified-relaxed-match",
            parentStableBucket: bucketResult.parentStableBucket,
            parentIsolatedBucket: bucketResult.parentIsolatedBucket,
            relaxedAxes: bucketResult.relaxedAxes,
            relaxedAxisValues: bucketResult.relaxedAxisValues,
            entropyScore: Number(bucketResult.entropyScore ?? 0),
            repairRate: Number(bucketResult.repairRate ?? 0),
            acceptedInvalidReplayCount: 0,
            rawInvalidReplayCount: 0,
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  if (String(sampleTag).toLowerCase() === "iron-step14") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step13-action-value.jsonl"))).map((row) => ({
      ...row,
      sourceCorpusTag: "iron-step14",
      metadata: {
        ...(row.metadata ?? {}),
        sampleTag: "iron-step14",
      },
    }));
    const { report, reportPath } = await readStep14VerificationReport();
    const samples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags: ["iron-step5", "iron-step6"] });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );

    for (const bucketResult of report.bucketResults ?? []) {
      if (String(bucketResult.verdict) !== "VERIFIED_EXPORTABLE") continue;
      if (Number(bucketResult.acceptedInvalidReplayCount ?? bucketResult.invalidReplayCount ?? 0) !== 0) continue;
      if (Number(bucketResult.repairRate ?? 0) > 0.3) continue;
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        if (!classified || classified.subBucketId !== STEP14_S02_V3_PARENT_BUCKET || classified.variantId !== bucketResult.variant) {
          return false;
        }
        const axes = classifyS02V3IsolationAxes(sample);
        return String(axes?.[bucketResult.isolationAxis] ?? "") === String(bucketResult.isolationValue ?? "");
      });
      const overrides = new Map(
        (bucketResult.exportableSamples ?? []).map((entry) => [
          [bucketResult.variant, entry.seed, entry.handId, entry.step, entry.actorSeat].join("|"),
          entry,
        ]),
      );
      for (const sample of matchingSamples) {
        const sampleOverride = overrides.get([sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|"));
        if (!sampleOverride) continue;
        const legalActions = normalizeLegalActions(sample.legalActions);
        const chosenAction = sampleOverride.chosenAction;
        if (!legalActions.some((entry) => actionType(entry) === actionType(chosenAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(chosenAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions: [
            {
              action: proAction,
              source: "pro",
              estimatedValue: bucketResult.proEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "BAD",
            },
            {
              action: chosenAction,
              source: "counterfactual",
              estimatedValue: bucketResult.stdEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "GOOD",
            },
          ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action))),
          chosenBestAction: chosenAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step14",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType: "verified-neighbor-v3-isolated",
          parentStableBucket: bucketResult.parentStableBucket,
          neighborAxis: bucketResult.neighborAxis,
          verificationConfidence: bucketResult.confidence,
          acceptedInvalidReplayCount: 0,
          rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          repairApplied: true,
          repairType: bucketResult.repairSummary?.[0]?.repairType ?? null,
          repairRate: Number(bucketResult.repairRate ?? 0),
          entropyScore: Number(bucketResult.entropyScore ?? 0),
          isolationAxis: bucketResult.isolationAxis,
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step14",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            replayConsistencyScore: bucketResult.replayConsistencyScore ?? null,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType: "verified-neighbor-v3-isolated",
            parentStableBucket: bucketResult.parentStableBucket,
            neighborAxis: bucketResult.neighborAxis,
            verificationConfidence: bucketResult.confidence,
            acceptedInvalidReplayCount: 0,
            rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
            repairApplied: true,
            repairType: bucketResult.repairSummary?.[0]?.repairType ?? null,
            repairRate: Number(bucketResult.repairRate ?? 0),
            entropyScore: Number(bucketResult.entropyScore ?? 0),
            isolationAxis: bucketResult.isolationAxis,
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  if (String(sampleTag).toLowerCase() === "iron-step13") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step12-action-value.jsonl"))).map((row) => ({
      ...row,
      sourceCorpusTag: "iron-step13",
      metadata: {
        ...(row.metadata ?? {}),
        sampleTag: "iron-step13",
      },
    }));
    const { report, reportPath } = await readStep13VerificationReport();
    const samples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags: ["iron-step5", "iron-step6"] });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );
    const overrides = new Map();
    for (const bucketResult of report.bucketResults ?? []) {
      for (const entry of bucketResult.exportableSamples ?? []) {
        overrides.set([bucketResult.variant, entry.seed, entry.handId, entry.step, entry.actorSeat].join("|"), {
          chosenAction: entry.chosenAction,
          repairApplied: Boolean(entry.repairApplied),
          repairType: entry.repairType ?? null,
          bucketResult,
        });
      }
    }

    for (const bucketResult of report.bucketResults ?? []) {
      if (!["VERIFIED_EXPORTABLE", "VERIFIED_WITH_REPAIR"].includes(String(bucketResult.verdict))) continue;
      if (Number(bucketResult.acceptedInvalidReplayCount ?? bucketResult.invalidReplayCount ?? 0) !== 0) continue;
      if (Number(bucketResult.repairRate ?? 0) > 0.3) continue;
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === bucketResult.bucket && classified.variantId === bucketResult.variant;
      });
      for (const sample of matchingSamples) {
        const sampleOverride = overrides.get([sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|"));
        if (!sampleOverride) continue;
        const legalActions = normalizeLegalActions(sample.legalActions);
        const chosenAction = sampleOverride.chosenAction;
        if (!legalActions.some((entry) => actionType(entry) === actionType(chosenAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(chosenAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        const sourceType = sampleOverride.repairApplied ? "verified-neighbor-v3-repaired" : "verified-neighbor-v3";
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions: [
            {
              action: proAction,
              source: "pro",
              estimatedValue: bucketResult.proEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "BAD",
            },
            {
              action: chosenAction,
              source: "counterfactual",
              estimatedValue: bucketResult.stdEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "GOOD",
            },
          ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action))),
          chosenBestAction: chosenAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step13",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType,
          parentStableBucket: bucketResult.parentStableBucket,
          neighborAxis: bucketResult.neighborAxis,
          verificationConfidence: bucketResult.confidence,
          acceptedInvalidReplayCount: 0,
          rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          repairApplied: sampleOverride.repairApplied,
          repairType: sampleOverride.repairType,
          repairRate: Number(bucketResult.repairRate ?? 0),
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step13",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            replayConsistencyScore: bucketResult.replayConsistencyScore ?? null,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType,
            parentStableBucket: bucketResult.parentStableBucket,
            neighborAxis: bucketResult.neighborAxis,
            verificationConfidence: bucketResult.confidence,
            acceptedInvalidReplayCount: 0,
            rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
            repairApplied: sampleOverride.repairApplied,
            repairType: sampleOverride.repairType,
            repairRate: Number(bucketResult.repairRate ?? 0),
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  if (String(sampleTag).toLowerCase() === "iron-step12") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step11-action-value.jsonl"))).map((row) => ({
      ...row,
      sourceCorpusTag: "iron-step12",
      metadata: {
        ...(row.metadata ?? {}),
        sampleTag: "iron-step12",
      },
    }));
    const { report, reportPath } = await readStep12VerificationReport();
    const samples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags: ["iron-step5", "iron-step6"] });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );
    const parentActionByBucket = new Map();
    for (const row of baseRows) {
      const key = `${row.variantId}|${row.parentStableBucket ?? row.bucket}`;
      if (!parentActionByBucket.has(key)) parentActionByBucket.set(key, row.chosenBestAction);
    }

    for (const bucketResult of report.bucketResults ?? []) {
      if (String(bucketResult.verdict) !== "VERIFIED_EXPANDABLE") continue;
      if (Number(bucketResult.acceptedInvalidReplayCount ?? bucketResult.invalidReplayCount ?? 0) !== 0) continue;
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === bucketResult.bucket && classified.variantId === bucketResult.variant;
      });
      const parentAction = parentActionByBucket.get(`${bucketResult.variant}|${bucketResult.parentStableBucket}`);
      if (!parentAction) continue;
      for (const sample of matchingSamples) {
        const legalActions = normalizeLegalActions(sample.legalActions);
        if (!legalActions.some((entry) => actionType(entry) === actionType(parentAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(parentAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions: [
            {
              action: proAction,
              source: "pro",
              estimatedValue: bucketResult.proEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "BAD",
            },
            {
              action: parentAction,
              source: "counterfactual",
              estimatedValue: bucketResult.stdEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "GOOD",
            },
          ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action))),
          chosenBestAction: parentAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step12",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType: "verified-neighbor-v3",
          parentStableBucket: bucketResult.parentStableBucket,
          neighborAxis: bucketResult.neighborAxis,
          verificationConfidence: bucketResult.confidence,
          acceptedInvalidReplayCount: 0,
          rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step12",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            replayConsistencyScore: bucketResult.replayConsistencyScore ?? null,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType: "verified-neighbor-v3",
            parentStableBucket: bucketResult.parentStableBucket,
            neighborAxis: bucketResult.neighborAxis,
            verificationConfidence: bucketResult.confidence,
            acceptedInvalidReplayCount: 0,
            rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  if (String(sampleTag).toLowerCase() === "iron-step11") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step10-action-value.jsonl"))).map((row) => {
      const existingType = String(row.sourceType ?? row.metadata?.sourceType ?? "stable-bucket");
      const normalizedType = existingType === "verified-neighbor" ? "verified-neighbor-v1" : existingType;
      return {
        ...row,
        sourceCorpusTag: "iron-step11",
        sourceType: normalizedType,
        metadata: {
          ...(row.metadata ?? {}),
          sampleTag: "iron-step11",
          sourceType: normalizedType,
        },
      };
    });
    const { report, reportPath } = await readStep11VerificationReport();
    const samples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags: STEP10_SOURCE_TAGS });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );
    const parentActionByBucket = new Map();
    for (const row of baseRows) {
      const key = `${row.variantId}|${row.parentStableBucket ?? row.bucket}`;
      if (!parentActionByBucket.has(key)) parentActionByBucket.set(key, row.chosenBestAction);
    }

    for (const bucketResult of report.bucketResults ?? []) {
      if (String(bucketResult.verdict) !== "VERIFIED_EXPANDABLE") continue;
      if (Number(bucketResult.acceptedInvalidReplayCount ?? bucketResult.invalidReplayCount ?? 0) !== 0) continue;
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === bucketResult.bucket && classified.variantId === bucketResult.variant;
      });
      const parentAction = parentActionByBucket.get(`${bucketResult.variant}|${bucketResult.parentStableBucket}`);
      if (!parentAction) continue;
      for (const sample of matchingSamples) {
        const legalActions = normalizeLegalActions(sample.legalActions);
        if (!legalActions.some((entry) => actionType(entry) === actionType(parentAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(parentAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions: [
            {
              action: proAction,
              source: "pro",
              estimatedValue: bucketResult.proEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "BAD",
            },
            {
              action: parentAction,
              source: "counterfactual",
              estimatedValue: bucketResult.stdEv,
              sampleCount: bucketResult.sampleCount,
              confidence: bucketResult.confidence,
              verdict: "GOOD",
            },
          ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action))),
          chosenBestAction: parentAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step11",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType: "verified-neighbor-v2",
          parentStableBucket: bucketResult.parentStableBucket,
          neighborAxis: bucketResult.neighborAxis,
          verificationConfidence: bucketResult.confidence,
          acceptedInvalidReplayCount: 0,
          rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step11",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            replayConsistencyScore: bucketResult.replayConsistencyScore ?? null,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType: "verified-neighbor-v2",
            parentStableBucket: bucketResult.parentStableBucket,
            neighborAxis: bucketResult.neighborAxis,
            verificationConfidence: bucketResult.confidence,
            acceptedInvalidReplayCount: 0,
            rawInvalidReplayCount: Number(bucketResult.rawInvalidReplayCount ?? 0),
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  if (String(sampleTag).toLowerCase() === "iron-step10") {
    const baseRows = (await readExistingDatasetRows(path.resolve("data/ai/action-value/iron-step7-action-value.jsonl")))
      .filter((row) => isStableStep10ParentRow(row))
      .map((row) => ({
        ...row,
        sourceCorpusTag: "iron-step10",
        sourceType: "stable-bucket",
        parentStableBucket: row.bucket,
        neighborAxis: null,
        verificationConfidence: 1,
        metadata: {
          ...(row.metadata ?? {}),
          sampleTag: "iron-step10",
          sourceType: "stable-bucket",
          parentStableBucket: row.bucket,
          neighborAxis: null,
          verificationConfidence: 1,
        },
      }));
    const { report, reportPath } = await readStep10VerificationReport();
    const samples = await readNeighborSourceSamples({ variants, sourceTags: STEP10_SOURCE_TAGS });
    const rows = [...baseRows];
    const seen = new Set(
      rows.map((row) =>
        [
          row.variantId,
          row.metadata?.seed,
          row.metadata?.handId,
          row.metadata?.step,
          row.metadata?.actorSeat,
          row.bucket,
          actionType(row.chosenBestAction),
        ].join("|"),
      ),
    );
    const parentActionByBucket = new Map();
    for (const row of baseRows) {
      const key = `${row.variantId}|${row.bucket}`;
      if (!parentActionByBucket.has(key)) {
        parentActionByBucket.set(key, row.chosenBestAction);
      }
    }

    for (const bucketResult of report.bucketResults ?? []) {
      if (String(bucketResult.verdict) !== "VERIFIED_EXPANDABLE") continue;
      const matchingSamples = samples.filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === bucketResult.bucket && classified.variantId === bucketResult.variant;
      });
      const parentAction = parentActionByBucket.get(`${bucketResult.variant}|${bucketResult.parentStableBucket}`);
      if (!parentAction) continue;
      for (const sample of matchingSamples) {
        const legalActions = normalizeLegalActions(sample.legalActions);
        if (!legalActions.some((entry) => actionType(entry) === actionType(parentAction))) continue;
        const payload = buildDrawObservationPayload({
          state: sample.state ?? sample.snapshot,
          seatIndex: sample.actorSeat,
          variantId: sample.variantId,
          legalActions,
        });
        const observation = buildDrawObservationVector(payload);
        if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
        const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
        const candidateActions = [
          {
            action: proAction,
            source: "pro",
            estimatedValue: bucketResult.proEv,
            sampleCount: bucketResult.sampleCount,
            confidence: bucketResult.confidence,
            verdict: "BAD",
          },
          {
            action: parentAction,
            source: "counterfactual",
            estimatedValue: bucketResult.stdEv,
            sampleCount: bucketResult.sampleCount,
            confidence: bucketResult.confidence,
            verdict: "GOOD",
          },
        ].filter((candidate) => legalActions.some((entry) => actionType(entry) === actionType(candidate.action)));
        if (!candidateActions.length) continue;
        const rowKey = [
          sample.variantId,
          sample.seed,
          sample.handId,
          sample.step,
          sample.actorSeat,
          bucketResult.bucket,
          actionType(parentAction),
        ].join("|");
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        rows.push({
          variantId: sample.variantId,
          schemaVersion: 1,
          observation,
          legalActions,
          candidateActions,
          chosenBestAction: parentAction,
          handClass: sample.handClass,
          bucket: bucketResult.bucket,
          sourceCorpusTag: "iron-step10",
          sourceCounterfactualScore: reportPath,
          trainingWeight: Number((Number(bucketResult.confidence ?? 0) * Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50)).toFixed(4)),
          sourceType: "verified-neighbor",
          parentStableBucket: bucketResult.parentStableBucket,
          neighborAxis: bucketResult.neighborAxis,
          verificationConfidence: bucketResult.confidence,
          weightComponents: {
            confidence: Number(Number(bucketResult.confidence ?? 0).toFixed(4)),
            sampleCountFactor: Number(Math.min(1, Number(bucketResult.sampleCount ?? 0) / 50).toFixed(4)),
            replayConsistencyFactor: Number(Number(bucketResult.replayConsistencyScore ?? 1).toFixed(4)),
            variantRebalanceFactor: 1,
            bucketRarityFactor: 1,
          },
          metadata: {
            sampleTag: "iron-step10",
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            drawRound: sample.drawRound,
            bettingRound: sample.bettingRound,
            playerCount: sample.playerCount,
            position: sample.position,
            facingAction: sample.facingAction,
            potSize: sample.potSize ?? sample.pot ?? 0,
            counterfactualVerdict: bucketResult.verdict,
            replayDeterministic: true,
            legalityValidated: true,
            replayConsistencyScore: bucketResult.replayConsistencyScore ?? null,
            safetyVerdict: "PASS",
            counterfactualReportPath: reportPath,
            sourceType: "verified-neighbor",
            parentStableBucket: bucketResult.parentStableBucket,
            neighborAxis: bucketResult.neighborAxis,
            verificationConfidence: bucketResult.confidence,
          },
        });
      }
    }

    const outputPath =
      datasetPath ??
      path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      outputPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
    return {
      outputPath,
      specPath: SPEC_OUTPUT_PATH,
      rowCount: rows.length,
      counterfactualReportPath: reportPath,
    };
  }

  const samples = await readTaggedSamples(variants, sampleTag);
  const { report, reportPath } = await readCounterfactualReport(variants, sampleTag);
  const bucketMap = new Map();
  for (const row of report.bucketResults ?? []) {
    bucketMap.set(keyForBucketResult(row), row);
  }

  const rows = [];
  const seen = new Set();
  const stableCountsByVariant = new Map();
  const stableCountsByBucket = new Map();
  const outputPath =
    datasetPath ??
    path.resolve("data/ai/action-value", `${String(sampleTag).toLowerCase()}-action-value.jsonl`);

  if (String(sampleTag).toLowerCase() === "iron-step7") {
    const baseRows = await readExistingDatasetRows(
      path.resolve("data/ai/action-value/iron-step6-action-value.jsonl"),
    );
    for (const row of baseRows) {
      rows.push(row);
      const rowKey = [
        row.variantId,
        row.metadata?.seed,
        row.metadata?.handId,
        row.metadata?.step,
        row.metadata?.actorSeat,
        row.bucket,
        actionType(row.chosenBestAction),
      ].join("|");
      seen.add(rowKey);
    }
  }

  for (const sample of samples) {
    const bucket = bucketForReplaySample(sample);
    if (!bucket || isTrashOrWeakBucket(bucket)) continue;
    const result = bucketMap.get(
      keyForBucketResult({
        variant: sample.variantId,
        bucket,
        proAction: actionType(sample.proAction),
        stdAction: actionType(sample.standardAction),
      }),
    );
    if (!result) continue;
    if (String(result.verdict ?? "") !== "STABLE_STANDARD_BETTER") continue;
    const threshold = String(sampleTag).toLowerCase() === "iron-step7" ? Math.max(confidenceThreshold, 0.9) : confidenceThreshold;
    if (!Number.isFinite(result.confidence) || result.confidence < threshold) continue;
    if (result.replayDeterministic === false) continue;
    if (result.legalityValidated === false) continue;
    const signFlipRate = Math.min(Number(result.positiveRate ?? 0), Number(result.negativeRate ?? 0));
    if (String(sampleTag).toLowerCase() === "iron-step7" && signFlipRate > 0.2) continue;
    stableCountsByVariant.set(sample.variantId, (stableCountsByVariant.get(sample.variantId) ?? 0) + 1);
    const bucketKey = `${sample.variantId}|${bucket}`;
    stableCountsByBucket.set(bucketKey, (stableCountsByBucket.get(bucketKey) ?? 0) + 1);
  }

  for (const sample of samples) {
    const bucket = bucketForReplaySample(sample);
    if (!bucket || isTrashOrWeakBucket(bucket)) continue;
    const result = bucketMap.get(
      keyForBucketResult({
        variant: sample.variantId,
        bucket,
        proAction: actionType(sample.proAction),
        stdAction: actionType(sample.standardAction),
      }),
    );
    if (!result) continue;
    if (String(result.verdict ?? "") !== "STABLE_STANDARD_BETTER") continue;
    const threshold = String(sampleTag).toLowerCase() === "iron-step7" ? Math.max(confidenceThreshold, 0.9) : confidenceThreshold;
    if (!Number.isFinite(result.confidence) || result.confidence < threshold) continue;
    if (result.replayDeterministic === false) continue;
    if (result.legalityValidated === false) continue;
    const signFlipRate = Math.min(Number(result.positiveRate ?? 0), Number(result.negativeRate ?? 0));
    if (String(sampleTag).toLowerCase() === "iron-step7" && signFlipRate > 0.2) continue;
    const state = sample.state ?? sample.snapshot;
    const legalActions = normalizeLegalActions(sample.legalActions);
    const payload = buildDrawObservationPayload({
      state,
      seatIndex: sample.actorSeat,
      variantId: sample.variantId,
      legalActions,
    });
    const observation = buildDrawObservationVector(payload);
    if (observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
    const proAction = typeof sample.proAction === "string" ? { type: sample.proAction } : sample.proAction;
    const stdAction =
      typeof sample.standardAction === "string" ? { type: sample.standardAction } : sample.standardAction;
    const candidateByType = new Map();
    [
      {
        action: proAction,
        source: "pro",
        estimatedValue: result.proEv,
        verdict: result.proEv >= result.stdEv ? "GOOD" : "BAD",
      },
      {
        action: stdAction,
        source: "standard",
        estimatedValue: result.stdEv,
        verdict: result.stdEv >= result.proEv ? "GOOD" : "BAD",
      },
    ].forEach((candidate) => {
      if (!actionType(candidate.action)) return;
      if (!legalActions.some((legalAction) => actionType(legalAction) === actionType(candidate.action))) return;
      if (!candidateByType.has(actionType(candidate.action))) {
        candidateByType.set(actionType(candidate.action), {
          action: candidate.action,
          source: candidate.source,
          estimatedValue: candidate.estimatedValue,
          sampleCount: result.sampleCount,
          confidence: result.confidence,
          verdict: candidate.verdict,
        });
      }
    });
    const candidateActions = [...candidateByType.values()];
    if (!candidateActions.length) continue;
    const chosenBestAction = [...candidateActions].sort(
      (left, right) => right.estimatedValue - left.estimatedValue,
    )[0].action;
    const rowKey = [
      sample.variantId,
      sample.seed,
      sample.handId,
      sample.step,
      sample.actorSeat,
      bucket,
      actionType(chosenBestAction),
    ].join("|");
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    const sampleCountFactor = Number(Math.min(1, Number(result.sampleCount ?? 0) / 50).toFixed(4));
    const replayConsistencyFactor = Number(
      Math.max(0.5, Number(result.stabilityAcrossSeeds ?? 0) || Number(result.confidence ?? 0) || 0.5).toFixed(4),
    );
    const variantShare =
      (stableCountsByVariant.get(sample.variantId) ?? 0) /
      Math.max(
        1,
        [...stableCountsByVariant.values()].reduce((sum, value) => sum + value, 0),
      );
    const variantRebalanceFactor = Number(Math.max(0.5, 1 - variantShare + 0.25).toFixed(4));
    const bucketShare =
      (stableCountsByBucket.get(`${sample.variantId}|${bucket}`) ?? 0) /
      Math.max(
        1,
        [...stableCountsByBucket.values()].reduce((sum, value) => sum + value, 0),
      );
    const bucketRarityFactor = Number(Math.max(0.5, 1 - bucketShare + 0.25).toFixed(4));
    const weightComponents = {
      confidence: Number(Number(result.confidence ?? 0).toFixed(4)),
      sampleCountFactor,
      replayConsistencyFactor,
      variantRebalanceFactor,
      bucketRarityFactor,
    };
    rows.push({
      variantId: sample.variantId,
      schemaVersion: 1,
      observation,
      legalActions,
      candidateActions,
      chosenBestAction,
      handClass: sample.handClass,
      bucket,
      sourceCorpusTag: sampleTag,
      sourceCounterfactualScore: reportPath,
      trainingWeight: Number(
        (
          weightComponents.confidence *
          weightComponents.sampleCountFactor *
          weightComponents.replayConsistencyFactor *
          weightComponents.variantRebalanceFactor *
          weightComponents.bucketRarityFactor
        ).toFixed(4),
      ),
      weightComponents,
      metadata: {
        sampleTag,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        drawRound: sample.drawRound,
        bettingRound: sample.bettingRound,
        playerCount: sample.playerCount,
        position: sample.position,
        facingAction: sample.facingAction,
        potSize: sample.potSize ?? sample.pot ?? 0,
        counterfactualVerdict: result.verdict,
        replayDeterministic: result.replayDeterministic !== false,
        legalityValidated: result.legalityValidated !== false,
        replayConsistencyScore: result.replayConsistencyScore ?? result.stabilityAcrossSeeds ?? null,
        safetyVerdict: "PASS",
        counterfactualReportPath: reportPath,
      },
    });
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    outputPath,
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
    "utf8",
  );
  await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
  return {
    outputPath,
    specPath: SPEC_OUTPUT_PATH,
    rowCount: rows.length,
    counterfactualReportPath: reportPath,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await exportActionValueDataset(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
