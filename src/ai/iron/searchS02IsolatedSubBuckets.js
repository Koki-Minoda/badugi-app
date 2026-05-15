import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import {
  average,
  countBy,
  entropyFromCounts,
  focusedObservationAxisValue,
  rowsFromFocusedReport,
  signFlipRate,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_ISOLATED_SUBBUCKETS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-isolated-subbuckets-step28.json",
);

const SUBBUCKET_AXES = ["playerCount", "position", "callBand", "pressureFamily", "stackDepth", "drawRound", "toCallRatio"];

async function loadFocusedReport() {
  try {
    return JSON.parse(await fs.readFile(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return runFocusedS02Counterfactual({ runReplay: false });
  }
}

function classifySubBucket({ sampleCount, confidence, repairRate, signFlip, invalidReplayCount, actualCounterfactualReplay = true }) {
  if (!actualCounterfactualReplay && sampleCount >= 10 && repairRate <= 0.2 && invalidReplayCount === 0) return "COUNTERFACTUAL_ONLY";
  if (sampleCount >= 30 && confidence >= 0.75 && repairRate <= 0.1 && signFlip <= 0.1 && invalidReplayCount === 0) {
    return "EXPORTABLE_CANDIDATE";
  }
  if (sampleCount >= 10 && repairRate <= 0.2 && invalidReplayCount === 0) return "COUNTERFACTUAL_ONLY";
  return "DO_NOT_TOUCH";
}

function summarizeGroup(bucket, rows, actualCounterfactualReplay = true) {
  const signFlip = signFlipRate(rows.map((row) => row.delta));
  const repairRate = rows.length ? rows.filter((row) => row.legality?.repairRequired || row.repairRequired).length / rows.length : 0;
  const invalidReplayCount = rows.filter((row) => row.ok === false || row.legality?.invalidReplay).length;
  const confidence = Math.min(0.95, (rows.length / 40) * (1 - signFlip) * (1 - Math.min(0.5, repairRate)));
  const entropy = entropyFromCounts(countBy(rows, (row) => (Number(row.delta) > 0 ? "positive" : Number(row.delta) < 0 ? "negative" : "zero")));
  return {
    bucket,
    sampleCount: rows.length,
    meanDelta: Number(average(rows.map((row) => row.delta)).toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    signFlipRate: signFlip,
    entropy,
    repairRate: Number(repairRate.toFixed(4)),
    invalidReplayCount,
    verdict: classifySubBucket({ sampleCount: rows.length, confidence, repairRate, signFlip, invalidReplayCount, actualCounterfactualReplay }),
  };
}

export function searchS02IsolatedSubBuckets({ focusedReport = null, rows = null, topN = 20 } = {}) {
  const inputRows = rows ?? rowsFromFocusedReport(focusedReport ?? {});
  const actualCounterfactualReplay = focusedReport?.actualCounterfactualReplay ?? Boolean(rows);
  const groups = new Map();
  for (const axis of SUBBUCKET_AXES) {
    inputRows.forEach((row) => {
      const key = `${axis}=${focusedObservationAxisValue(row, axis)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
  }
  for (let index = 0; index < SUBBUCKET_AXES.length; index += 1) {
    for (let next = index + 1; next < SUBBUCKET_AXES.length; next += 1) {
      const leftAxis = SUBBUCKET_AXES[index];
      const rightAxis = SUBBUCKET_AXES[next];
      inputRows.forEach((row) => {
        const key = `${leftAxis}=${focusedObservationAxisValue(row, leftAxis)}|${rightAxis}=${focusedObservationAxisValue(row, rightAxis)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });
    }
  }
  const subBuckets = [...groups.entries()]
    .map(([bucket, group]) => summarizeGroup(bucket, group, actualCounterfactualReplay))
    .sort((left, right) => {
      const verdictRank = { EXPORTABLE_CANDIDATE: 3, COUNTERFACTUAL_ONLY: 2, DO_NOT_TOUCH: 1 };
      return (verdictRank[right.verdict] ?? 0) - (verdictRank[left.verdict] ?? 0) || right.sampleCount - left.sampleCount;
    })
    .slice(0, topN);
  return {
    generatedAt: new Date().toISOString(),
    bucket: focusedReport?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    thresholds: {
      sampleCount: 30,
      confidence: 0.75,
      repairRateMax: 0.1,
      signFlipRateMax: 0.1,
      invalidReplayCount: 0,
    },
    subBuckets,
    exportableCount: subBuckets.filter((row) => row.verdict === "EXPORTABLE_CANDIDATE").length,
    outputPath: DEFAULT_STEP28_ISOLATED_SUBBUCKETS_OUTPUT_PATH,
  };
}

export async function writeS02IsolatedSubBucketSearch({
  outputPath = DEFAULT_STEP28_ISOLATED_SUBBUCKETS_OUTPUT_PATH,
  ...input
} = {}) {
  const focusedReport = input.focusedReport ?? (input.rows ? null : await loadFocusedReport());
  const report = searchS02IsolatedSubBuckets({ ...input, focusedReport });
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02IsolatedSubBucketSearch();
  console.log(JSON.stringify(report, null, 2));
}
