import fs from "node:fs/promises";
import path from "node:path";

import { classifyD01SubBucket } from "./d01SubBucketClassifier.js";

function round(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function shannonEntropy(counts = []) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return round(
    counts.reduce((entropy, count) => {
      if (!count) return entropy;
      const p = count / total;
      return entropy - p * Math.log2(p);
    }, 0),
  );
}

export function analyzeBucketEntropy({ samples = [], bucketResults = [] } = {}) {
  const sampleAgg = new Map();
  for (const sample of samples) {
    const sub = classifyD01SubBucket(sample);
    if (!sub) continue;
    const pair = `${actionType(sample.proAction)}->${actionType(sample.standardAction)}`;
    if (!sampleAgg.has(sub.subBucketId)) {
      sampleAgg.set(sub.subBucketId, {
        subBucketId: sub.subBucketId,
        parentBucket: sub.parentBucket,
        decomposition: sub.decomposition,
        actionDistribution: new Map(),
      });
    }
    const aggregate = sampleAgg.get(sub.subBucketId);
    aggregate.actionDistribution.set(pair, (aggregate.actionDistribution.get(pair) ?? 0) + 1);
  }

  const resultAgg = new Map();
  for (const row of bucketResults) {
    const bucket = String(row.bucket ?? "");
    if (!bucket.includes("|")) continue;
    if (!resultAgg.has(bucket)) {
      const sampleMeta = sampleAgg.get(bucket);
      resultAgg.set(bucket, {
        subBucketId: bucket,
        parentBucket: sampleMeta?.parentBucket ?? bucket.split("|")[0],
        decomposition: sampleMeta?.decomposition ?? null,
        sampleCount: 0,
        meanDeltaWeighted: 0,
        varianceAccumulator: 0,
        positiveWeight: 0,
        negativeWeight: 0,
        confidenceWeighted: 0,
        actionDistribution: sampleMeta?.actionDistribution ?? new Map(),
      });
    }
    const aggregate = resultAgg.get(bucket);
    const count = Number(row.sampleCount ?? 0);
    const meanDelta = Number(row.meanDelta ?? 0);
    const stdDev = Number(row.stdDev ?? 0);
    const confidence = Number(row.confidence ?? 0);
    aggregate.sampleCount += count;
    aggregate.meanDeltaWeighted += meanDelta * count;
    aggregate.varianceAccumulator += ((stdDev ** 2) + (meanDelta ** 2)) * count;
    aggregate.positiveWeight += Number(row.positiveRate ?? 0) * count;
    aggregate.negativeWeight += Number(row.negativeRate ?? 0) * count;
    aggregate.confidenceWeighted += confidence * count;
  }

  const rows = [...resultAgg.values()].map((aggregate) => {
    const sampleCount = Math.max(1, aggregate.sampleCount);
    const meanDelta = aggregate.meanDeltaWeighted / sampleCount;
    const meanSquare = aggregate.varianceAccumulator / sampleCount;
    const variance = Math.max(0, meanSquare - meanDelta ** 2);
    const stddevDelta = Math.sqrt(variance);
    const positiveRate = aggregate.positiveWeight / sampleCount;
    const negativeRate = aggregate.negativeWeight / sampleCount;
    const signFlipRate = Math.min(positiveRate, negativeRate);
    const confidence = aggregate.confidenceWeighted / sampleCount;
    const actionCounts = [...aggregate.actionDistribution.values()];
    const actionDistribution = Object.fromEntries([...aggregate.actionDistribution.entries()]);
    const entropyScore = shannonEntropy(actionCounts);
    return {
      subBucketId: aggregate.subBucketId,
      parentBucket: aggregate.parentBucket,
      decomposition: aggregate.decomposition,
      sampleCount: aggregate.sampleCount,
      actionDistribution,
      meanDelta: round(meanDelta, 2),
      stddevDelta: round(stddevDelta, 2),
      signFlipRate: round(signFlipRate, 4),
      confidence: round(confidence, 4),
      entropyScore,
    };
  }).sort((left, right) => right.sampleCount - left.sampleCount);

  return {
    rowCount: rows.length,
    rows,
    stableCandidates: rows.filter(
      (row) => row.sampleCount >= 40 && row.confidence >= 0.8 && row.signFlipRate <= 0.2 && row.entropyScore <= 1.2,
    ),
  };
}

export async function writeBucketEntropyReport({ samples = [], bucketResults = [], outputPath } = {}) {
  const report = analyzeBucketEntropy({ samples, bucketResults });
  const resolved = outputPath ?? path.resolve("reports/ai-eval/d01-bucket-entropy-step7.json");
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(report, null, 2), "utf8");
  return { outputPath: resolved, report };
}

