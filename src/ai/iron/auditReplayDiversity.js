import fs from "node:fs/promises";
import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP31_REPLAY_DIVERSITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/replay-diversity-step31.json",
);
export const DEFAULT_STEP27_STANDARD_ADVANTAGE_PATH = path.resolve(
  "reports/ai-iron/standard-advantage-attribution-step27.json",
);

const DIMENSIONS = [
  ["variant", ["D02", "S01", "S02"]],
  ["position", ["small-blind", "big-blind", "blind", "early", "middle", "late", "cutoff", "button"]],
  ["playerCount", ["HU", "3way", "4way+"]],
  ["pressureFamily", ["open-or-checkback", "bet-pressure", "raise-pressure"]],
  ["stackDepth", ["shallow", "medium", "deep", "ultra-deep"]],
  ["drawRound", ["draw-0", "draw-1", "draw-2", "draw-3", "showdown"]],
];

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function normalizedEntropy(values = []) {
  const counts = new Map();
  values.forEach((value) => counts.set(String(value ?? "unknown"), (counts.get(String(value ?? "unknown")) ?? 0) + 1));
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0 || counts.size <= 1) return 0;
  const entropy = [...counts.values()].reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);
  return roundNumber(entropy / Math.log2(counts.size), 4);
}

function valueForDimension(entry = {}, dimension = "") {
  if (dimension === "variant") return entry.variant ?? entry.variantId ?? "unknown";
  if (dimension === "playerCount") {
    const value = entry.playerCount ?? entry.playerCountClass ?? "unknown";
    return value === "heads-up" ? "HU" : value;
  }
  if (dimension === "stackDepth") return entry.stackDepth ?? entry.stackDepthBand ?? "unknown";
  if (dimension === "drawRound") {
    const value = entry.drawRound ?? "unknown";
    if (typeof value === "number") return `draw-${value}`;
    return value;
  }
  return entry[dimension] ?? "unknown";
}

export function auditReplayDiversity({ rows = [], dimensions = DIMENSIONS } = {}) {
  const table = dimensions.map(([dimension, expectedValues]) => {
    const values = rows.map((row) => valueForDimension(row, dimension));
    const uniqueValues = Array.from(new Set(values.map((value) => String(value ?? "unknown")))).sort();
    const knownUnique = uniqueValues.filter((value) => value !== "unknown").length;
    const expected = expectedValues.length;
    return {
      dimension,
      unique: uniqueValues.length,
      uniqueValues,
      entropy: normalizedEntropy(values),
      coverage: roundNumber(knownUnique / Math.max(1, expected), 4),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    sampleCount: rows.length,
    dimensions: table,
    candidateScarcityLikelyDistributionDriven: table.some((entry) => entry.coverage < 0.5 || entry.entropy < 0.35),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_REPLAY_DIVERSITY_OUTPUT_PATH,
  };
}

export async function writeReplayDiversityAudit({
  inputPath = DEFAULT_STEP27_STANDARD_ADVANTAGE_PATH,
  outputPath = DEFAULT_STEP31_REPLAY_DIVERSITY_OUTPUT_PATH,
  rows,
} = {}) {
  const report = rows ? { buckets: rows } : await readJsonIfExists(inputPath);
  return writeJsonReport(outputPath, auditReplayDiversity({ rows: report?.buckets ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayDiversityAudit();
  console.log(JSON.stringify(report, null, 2));
}
