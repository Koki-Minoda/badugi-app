import fs from "node:fs/promises";
import path from "node:path";

import { parseSubBucketAxes } from "../evaluation/discoverStableNeighborBuckets.js";

const DEFAULT_ARENA_RESULT_PATH = path.resolve("reports/ai-iron/iron-step12-offline-arena-result.json");
const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/s01-opportunity-sampling-step12.json");
const TARGET_BUCKET = "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated";

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    arenaResultPath:
      typeof options["arena-result"] === "string" && options["arena-result"].trim().length
        ? path.resolve(String(options["arena-result"]))
        : DEFAULT_ARENA_RESULT_PATH,
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : DEFAULT_OUTPUT_PATH,
  };
}

function count(map = {}, key = "") {
  return Number(map?.[key] ?? 0);
}

function classifyAxisMismatch(targetAxes = {}, candidateBucket = "") {
  const axes = parseSubBucketAxes(candidateBucket);
  if (!axes.playerCountBand && !axes.positionBand) return null;
  if (axes.positionBand && axes.positionBand !== targetAxes.positionBand) return "positionMismatch";
  if (axes.playerCountBand && axes.playerCountBand !== targetAxes.playerCountBand) return "playerCountMismatch";
  if (axes.toCallBand && axes.toCallBand !== targetAxes.toCallBand) return "callBandMismatch";
  if (axes.repeatedPressure && axes.repeatedPressure !== targetAxes.repeatedPressure) return "repeatFlagMismatch";
  return "bucketMismatch";
}

export async function analyzeS01OpportunitySampling({
  arenaResultPath = DEFAULT_ARENA_RESULT_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const report = JSON.parse(await fs.readFile(arenaResultPath, "utf8"));
  const s01 = (report.results ?? []).find((entry) => entry.variant === "S01") ?? {};
  const targetAxes = parseSubBucketAxes(TARGET_BUCKET);
  const exactHits = count(s01.bucketHitDistribution, TARGET_BUCKET);
  const directOpportunity = count(s01.candidateBucketObservations, TARGET_BUCKET);
  const fallbackReasons = s01.fallbackReasonByBucket?.[TARGET_BUCKET] ?? {};

  let positionMismatch = 0;
  let playerCountMismatch = 0;
  let callBandMismatch = 0;
  let repeatFlagMismatch = 0;
  for (const [bucket, value] of Object.entries(s01.candidateBucketObservations ?? {})) {
    if (!String(bucket).startsWith("strongSD27 top-end pressure::")) continue;
    if (bucket === TARGET_BUCKET) continue;
    const mismatch = classifyAxisMismatch(targetAxes, bucket);
    if (!mismatch) continue;
    if (mismatch === "positionMismatch") positionMismatch += Number(value ?? 0);
    if (mismatch === "playerCountMismatch") playerCountMismatch += Number(value ?? 0);
    if (mismatch === "callBandMismatch") callBandMismatch += Number(value ?? 0);
    if (mismatch === "repeatFlagMismatch") repeatFlagMismatch += Number(value ?? 0);
  }

  const exactFallbackTotal = Object.values(fallbackReasons).reduce((sum, value) => sum + Number(value ?? 0), 0);
  const result = {
    arenaId: report.arenaId ?? "iron-step12",
    targetBucket: TARGET_BUCKET,
    variant: "S01",
    exactHits,
    opportunityCount: directOpportunity,
    noMatchingState: Math.max(0, directOpportunity - exactHits - exactFallbackTotal),
    positionMismatch,
    playerCountMismatch,
    callBandMismatch,
    repeatFlagMismatch,
    actionIllegal: Number(fallbackReasons["action-illegal"] ?? 0),
    bucketMismatch: Number(fallbackReasons["bucket-mismatch"] ?? 0),
    legalButNotSelected: Number(fallbackReasons["no-dataset-match"] ?? 0),
    fallbackReasonByBucket: fallbackReasons,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  return result;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await analyzeS01OpportunitySampling(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
