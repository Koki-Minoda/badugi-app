import fs from "node:fs/promises";
import path from "node:path";

export const SOURCE_PRIORITY_ORDER = [
  "stable-bucket",
  "verified-neighbor-v1",
  "verified-neighbor-v2",
  "verified-neighbor-v3-isolated",
  "verified-relaxed-match",
];

export const DEFAULT_STEP20_SPECIFICITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-bucket-specificity-step20.json",
);

function countConstrainedAxes(row = {}) {
  const sourceType = String(row?.sourceType ?? row?.metadata?.sourceType ?? "");
  if (sourceType === "verified-neighbor-v3-isolated") return 4;
  if (sourceType === "verified-relaxed-match") return 3;
  if (sourceType === "verified-neighbor-v2") return 4;
  if (sourceType === "verified-neighbor-v1") return 4;
  return 1;
}

function sourcePriorityIndex(sourceType = "") {
  const index = SOURCE_PRIORITY_ORDER.indexOf(String(sourceType ?? ""));
  return index === -1 ? SOURCE_PRIORITY_ORDER.length : index;
}

export function bucketSpecificityScore(row = {}) {
  const sourceType = String(row?.sourceType ?? row?.metadata?.sourceType ?? "");
  const constrainedAxes = countConstrainedAxes(row);
  const confidence = Number(row?.confidence ?? row?.metadata?.confidence ?? 1) || 1;
  const entropyScore = Number(row?.entropyScore ?? row?.metadata?.entropyScore ?? 0) || 0;
  const trainingWeight = Number(row?.trainingWeight ?? 0) || 0;
  const priorityIndex = sourcePriorityIndex(sourceType);
  const score = Number(
    (
      constrainedAxes * 10 +
      confidence * 5 +
      trainingWeight * 2 -
      entropyScore * 10 -
      priorityIndex
    ).toFixed(4)
  );
  return {
    sourceType,
    constrainedAxes,
    confidence,
    entropyScore,
    trainingWeight,
    priorityIndex,
    score,
  };
}

export async function writeBucketSpecificityReport({
  rows = [],
  outputPath = DEFAULT_STEP20_SPECIFICITY_OUTPUT_PATH,
} = {}) {
  const report = (Array.isArray(rows) ? rows : []).map((row) => ({
    bucket: row.bucket,
    parentStableBucket: row.parentStableBucket ?? row.metadata?.parentStableBucket ?? null,
    ...bucketSpecificityScore(row),
  }));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
