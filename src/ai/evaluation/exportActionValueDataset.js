import fs from "node:fs/promises";
import path from "node:path";

import {
  buildDrawObservationPayload,
  buildDrawObservationVector,
  DRAW_OBSERVATION_VECTOR_SIZE,
} from "../../rl/drawObservationSchema.js";
import { AI_EVAL_DIVERGENCE_REPLAY_DIR, AI_EVAL_REPORT_DIR } from "./runAiEvaluationBatch.js";
import {
  bucketForReplaySample,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";

const DEFAULT_VARIANTS = ["D02", "S01", "S02"];
const DATASET_OUTPUT_PATH = path.resolve("data/ai/action-value/step4y-action-value.jsonl");
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
        const sample = JSON.parse(line);
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
  const preferred = candidates.find((file) => file.toLowerCase().includes(`-${sampleTag.toLowerCase()}.json`));
  const fallback = candidates[candidates.length - 1] ?? null;
  if (!preferred && !fallback) {
    throw new Error("No counterfactual score report found for action-value export");
  }
  const target = preferred ?? fallback;
  const report = JSON.parse(await fs.readFile(path.join(AI_EVAL_REPORT_DIR, target), "utf8"));
  return { report, reportPath: path.join(AI_EVAL_REPORT_DIR, target) };
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

export async function exportActionValueDataset({
  variants = DEFAULT_VARIANTS,
  sampleTag = "step4y",
  confidenceThreshold = 0.7,
} = {}) {
  const samples = await readTaggedSamples(variants, sampleTag);
  const { report, reportPath } = await readCounterfactualReport(variants, sampleTag);
  const bucketMap = new Map();
  for (const row of report.bucketResults ?? []) {
    bucketMap.set(keyForBucketResult(row), row);
  }

  const rows = [];
  const seen = new Set();

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
    if (!String(result.verdict ?? "").startsWith("STABLE_")) continue;
    if (!Number.isFinite(result.confidence) || result.confidence < confidenceThreshold) continue;
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
    rows.push({
      variantId: sample.variantId,
      schemaVersion: 1,
      observation,
      legalActions,
      candidateActions,
      chosenBestAction,
      handClass: sample.handClass,
      bucket,
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
        safetyVerdict: "PASS",
        counterfactualReportPath: reportPath,
      },
    });
  }

  await fs.mkdir(path.dirname(DATASET_OUTPUT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(SPEC_OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    DATASET_OUTPUT_PATH,
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
    "utf8",
  );
  await fs.writeFile(SPEC_OUTPUT_PATH, buildDatasetSpecMarkdown(), "utf8");
  return {
    outputPath: DATASET_OUTPUT_PATH,
    specPath: SPEC_OUTPUT_PATH,
    rowCount: rows.length,
    counterfactualReportPath: reportPath,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await exportActionValueDataset(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
