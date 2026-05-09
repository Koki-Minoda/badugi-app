import fs from "node:fs/promises";
import path from "node:path";
import {
  bucketForReplaySample,
  parseReplaySampleFilename,
  replaySampleTagPriority,
  shouldKeepReplaySample,
} from "./counterfactualBuckets.js";

const DEFAULT_VARIANTS = ["D02", "S01", "S02"];
const AI_EVAL_DIVERGENCE_REPLAY_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");
const AI_EVAL_REPORT_DIR = path.resolve("reports/ai-eval");
const DOC_OUTPUT_PATH = path.resolve(
  "docs/ai/MGX_PRO_STEP4Y_FRESH_VS_HISTORICAL_CORPUS.md",
);
const NEXT_ACTION_OUTPUT_PATH = path.resolve(
  "docs/ai/MGX_STEP4Y_PRO_VS_IRON_NEXT_ACTION.md",
);

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
    maxSamples: Number(options["max-samples"] ?? 5000),
    historicalTag: String(options["historical-tag"] ?? "step4w"),
    freshTag: String(options["fresh-tag"] ?? "step4y"),
    postPatchTag: String(options["postpatch-tag"] ?? "step4x"),
  };
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function bucketKey(sample = {}) {
  return `${sample.variantId}|${bucketForReplaySample(sample)}`;
}

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function summarizeCorpus(samples = []) {
  const byBucket = new Map();
  for (const sample of samples) {
    const bucket = bucketForReplaySample(sample);
    if (!bucket) continue;
    const key = bucketKey(sample);
    if (!byBucket.has(key)) {
      byBucket.set(key, {
        variant: sample.variantId,
        bucket,
        count: 0,
        guardActivationCount: 0,
        actionDistribution: new Map(),
        handClasses: new Set(),
      });
    }
    const aggregate = byBucket.get(key);
    aggregate.count += 1;
    aggregate.handClasses.add(sample.handClass);
    const pair = `${actionType(sample.proAction)}->${actionType(sample.standardAction)}`;
    aggregate.actionDistribution.set(pair, (aggregate.actionDistribution.get(pair) ?? 0) + 1);
    const reason = String(sample.proAction?.reason ?? "").toLowerCase();
    if (reason.includes("guard")) aggregate.guardActivationCount += 1;
  }
  return byBucket;
}

async function readSamplesForTag(variants = [], tag = "step4w") {
  const entries = await fs.readdir(AI_EVAL_DIVERGENCE_REPLAY_DIR).catch(() => []);
  const wanted = new Set(variants.map((variant) => variant.toLowerCase()));
  const chosenEntries = new Map();
  for (const entry of entries) {
    const parsed = parseReplaySampleFilename(entry);
    if (!parsed) continue;
    if (!wanted.has(parsed.variant.toLowerCase())) continue;
    if (String(parsed.tag).toLowerCase() !== String(tag).toLowerCase()) continue;
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
        if (shouldKeepReplaySample(sample)) samples.push(sample);
      });
  }
  return samples;
}

function buildScoreMap(report = {}) {
  const map = new Map();
  for (const row of report.bucketResults ?? []) {
    const key = `${row.variant}|${row.bucket}`;
    const current = map.get(key);
    if (!current || Number(row.sampleCount ?? 0) > Number(current.sampleCount ?? 0)) {
      map.set(key, row);
    }
  }
  return map;
}

function getStatus({ historical = null, fresh = null }) {
  if (!historical && fresh) return "NEW";
  if (historical && !fresh) return "DISAPPEARED";
  if (!historical && !fresh) return "NOISY";
  const historicalStable = String(historical.verdict ?? "").startsWith("STABLE");
  const freshStable = String(fresh.verdict ?? "").startsWith("STABLE");
  if (freshStable && historicalStable && historical.verdict === fresh.verdict) return "STABLE";
  if (historicalStable && !freshStable) return "REGRESSED";
  if (freshStable && !historicalStable) return "STABLE";
  return "NOISY";
}

function formatDelta(value) {
  return value == null ? "n/a" : `${round(value, 2)}`;
}

function buildMarkdown({
  variants,
  maxSamples,
  historicalTag,
  freshTag,
  historicalSamples,
  freshSamples,
  historicalReport,
  freshReport,
  historicalMatchedTag,
  freshMatchedTag,
  postPatchTag,
  postPatchSamples,
  rows,
}) {
  const lines = [
    "# MGX Step4-Y Fresh vs Historical Corpus",
    "",
    "Source artifacts:",
    `- historical corpus tag: \`${historicalTag}\`${historicalMatchedTag ? "" : " (counterfactual score fallback: unlabeled/legacy report)"}`,
    `- fresh corpus tag: \`${freshTag}\`${freshMatchedTag ? "" : " (counterfactual score fallback used)"}`,
    `- compared variants: \`${variants.join(",")}\``,
    `- max counterfactual samples: \`${maxSamples}\``,
    "",
    "## Corpus Summary",
    "",
    "| Corpus | Tag | Samples | Valid Replays | Invalid Replays | Notes |",
    "| ------ | --- | ------: | ------------: | --------------: | ----- |",
    `| Historical | \`${historicalTag}\` | ${historicalSamples.length} | ${historicalReport.validReplays} | ${historicalReport.invalidReplays} | Step4-W baseline corpus |`,
    `| Fresh | \`${freshTag}\` | ${freshSamples.length} | ${freshReport.validReplays} | ${freshReport.invalidReplays} | Live post-patch Step4-X policy corpus |`,
    `| Postpatch tag presence | \`${postPatchTag}\` | ${postPatchSamples.length} | n/a | n/a | Dedicated Step4-X replay tag ${postPatchSamples.length ? "exists" : "does not exist; fresh Step4-Y corpus is the current post-patch source of truth"} |`,
    "",
    "## Bucket Comparison",
    "",
    "| Bucket | Historical Count | Fresh Count | Historical Delta | Fresh Delta | Status |",
    "| ------ | ---------------: | ----------: | ---------------: | ----------: | ------ |",
  ];
  rows.forEach((row) => {
    lines.push(
      `| ${row.variant} \`${row.bucket}\` | ${row.historicalCount} | ${row.freshCount} | ${row.historicalDelta} | ${row.freshDelta} | \`${row.status}\` |`,
    );
  });
  lines.push(
    "",
    "## Notes",
    "",
    "- `DISAPPEARED` means the bucket no longer appears in the fresh tagged corpus at the filtered replay stage.",
    "- `NOISY` means neither corpus yields a stable replay-backed edge after fresh rescoring.",
    "- Dedicated `step4x` replay files are optional. When absent, Step4-Y fresh corpus is the authoritative post-patch comparison set.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function classifyBucket(row = {}) {
  const bucket = String(row.bucket ?? "");
  const verdict = String(row.freshVerdict ?? "");
  const confidence = Number(row.freshConfidence ?? 0);
  const lowerBucket = bucket.toLowerCase();
  if (lowerBucket.includes("trash") || lowerBucket.includes("weak")) {
    return {
      classification: "触らない",
      reason: "weak/trash guard risk or observationally noisy",
      next: "Guard維持。dataset negative-only でも原則 reopen しない。",
    };
  }
  if (verdict.startsWith("STABLE_") && confidence >= 0.7) {
    return {
      classification: "Pro heuristicで触る",
      reason: "high confidence replay-backed bucket",
      next: "極小 rule patch 候補",
    };
  }
  if (verdict === "NEEDS_MORE_SAMPLES" || verdict === "NOISY") {
    return {
      classification: "Iron datasetへ送る",
      reason: "sparse or state-dependent pattern; heuristic risk is higher than expected gain",
      next: "action-value dataset candidate",
    };
  }
  return {
    classification: "触らない",
    reason: "no clear edge",
    next: "追加 corpus まで保留",
  };
}

function buildNextActionMarkdown(rows = []) {
  const lines = [
    "# MGX Step4-Y Pro vs Iron Next Action",
    "",
    "| Bucket | Classification | Reason | Next |",
    "| ------ | -------------- | ------ | ---- |",
  ];
  rows.forEach((row) => {
    const classification = classifyBucket(row);
    lines.push(
      `| ${row.variant} \`${row.bucket}\` | ${classification.classification} | ${classification.reason} | ${classification.next} |`,
    );
  });
  return `${lines.join("\n")}\n`;
}

async function readCounterfactualReportForTag(
  variants = DEFAULT_VARIANTS,
  tag = "step4w",
  { avoidTags = [] } = {},
) {
  const files = await fs.readdir(AI_EVAL_REPORT_DIR).catch(() => []);
  const normalizedVariants = variants.map((variant) => variant.toLowerCase()).sort();
  const candidates = files
    .filter((file) => file.startsWith("counterfactual-score-") && file.endsWith(".json"))
    .filter((file) => normalizedVariants.every((variant) => file.toLowerCase().includes(variant)))
    .sort();
  let fallback = null;
  const avoided = new Set(avoidTags.map((entry) => String(entry).toLowerCase()).filter(Boolean));
  for (const target of candidates) {
    let report = null;
    try {
      report = JSON.parse(await fs.readFile(path.join(AI_EVAL_REPORT_DIR, target), "utf8"));
    } catch {
      continue;
    }
    const sampleTags = Array.isArray(report.sampleTagFilter)
      ? report.sampleTagFilter.map((entry) => String(entry).toLowerCase())
      : [];
    if (sampleTags.includes(String(tag).toLowerCase())) {
      return { report, outputPath: path.join(AI_EVAL_REPORT_DIR, target), matchedTag: tag };
    }
    if (!fallback && !sampleTags.some((entry) => avoided.has(entry))) {
      fallback = { report, outputPath: path.join(AI_EVAL_REPORT_DIR, target), matchedTag: null };
    }
    if (!fallback) {
      fallback = { report, outputPath: path.join(AI_EVAL_REPORT_DIR, target), matchedTag: null };
    }
  }
  if (fallback) {
    return fallback;
  }
  throw new Error(`No counterfactual report found for tag ${tag}`);
}

export async function compareDivergenceCorpora({
  variants = DEFAULT_VARIANTS,
  maxSamples = 5000,
  historicalTag = "step4w",
  freshTag = "step4y",
  postPatchTag = "step4x",
} = {}) {
  const historicalSamples = await readSamplesForTag(variants, historicalTag);
  const freshSamples = await readSamplesForTag(variants, freshTag);
  const postPatchSamples = await readSamplesForTag(variants, postPatchTag);

  const historicalScore = await readCounterfactualReportForTag(variants, historicalTag, {
    avoidTags: [freshTag],
  });
  const freshScore = await readCounterfactualReportForTag(variants, freshTag);

  const historicalSummary = summarizeCorpus(historicalSamples);
  const freshSummary = summarizeCorpus(freshSamples);
  const historicalScoreMap = buildScoreMap(historicalScore.report);
  const freshScoreMap = buildScoreMap(freshScore.report);

  const keys = new Set([
    ...historicalSummary.keys(),
    ...freshSummary.keys(),
    ...historicalScoreMap.keys(),
    ...freshScoreMap.keys(),
  ]);
  const rows = [...keys]
    .map((key) => {
      const historical = historicalScoreMap.get(key) ?? null;
      const fresh = freshScoreMap.get(key) ?? null;
      const [variant, bucket] = key.split("|");
      return {
        variant,
        bucket,
        historicalCount: historicalSummary.get(key)?.count ?? 0,
        freshCount: freshSummary.get(key)?.count ?? 0,
        historicalDelta: formatDelta(historical?.meanDelta),
        freshDelta: formatDelta(fresh?.meanDelta),
        historicalVerdict: historical?.verdict ?? "NO_DATA",
        freshVerdict: fresh?.verdict ?? "NO_DATA",
        freshConfidence: fresh?.confidence ?? 0,
        status: getStatus({ historical, fresh }),
      };
    })
    .sort((left, right) => {
      const variantCompare = left.variant.localeCompare(right.variant);
      if (variantCompare !== 0) return variantCompare;
      return left.bucket.localeCompare(right.bucket);
    });

  const markdown = buildMarkdown({
    variants,
    maxSamples,
    historicalTag,
    freshTag,
    historicalSamples,
    freshSamples,
    historicalReport: historicalScore.report,
    freshReport: freshScore.report,
    historicalMatchedTag: historicalScore.matchedTag,
    freshMatchedTag: freshScore.matchedTag,
    postPatchTag,
    postPatchSamples,
    rows,
  });
  const nextActionMarkdown = buildNextActionMarkdown(rows);
  await fs.mkdir(path.dirname(DOC_OUTPUT_PATH), { recursive: true });
  await fs.writeFile(DOC_OUTPUT_PATH, markdown, "utf8");
  await fs.writeFile(NEXT_ACTION_OUTPUT_PATH, nextActionMarkdown, "utf8");

  return {
    historicalSamples: historicalSamples.length,
    freshSamples: freshSamples.length,
    rows,
    outputs: {
      comparisonDoc: DOC_OUTPUT_PATH,
      nextActionDoc: NEXT_ACTION_OUTPUT_PATH,
      historicalScore: historicalScore.outputPath,
      freshScore: freshScore.outputPath,
    },
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await compareDivergenceCorpora(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
