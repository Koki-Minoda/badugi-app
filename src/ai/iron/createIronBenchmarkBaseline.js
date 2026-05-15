import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP22_BENCHMARK_BASELINE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step22-benchmark-baseline.json",
);

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
const DEFAULT_PRIORITY_PATH = path.resolve("reports/ai-iron/s02-bucket-specificity-step20.json");
const DEFAULT_DETERMINISM_PATH = path.resolve("reports/ai-eval/replay-determinism-audit-iron-step17.json");

function parseJsonl(text = "") {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarizeRows(rows = []) {
  const variants = new Set();
  const stableParents = new Set();
  const verifiedNeighbors = new Set();
  const relaxedSources = new Set();
  const sourceTypeCounts = {};

  for (const row of rows) {
    const variantId = String(row?.variantId ?? "").trim();
    if (variantId) variants.add(variantId);

    const sourceType = String(row?.sourceType ?? row?.metadata?.sourceType ?? "unknown");
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;

    if (sourceType === "stable-bucket") {
      stableParents.add(String(row?.bucket ?? ""));
    }
    if (sourceType.startsWith("verified-neighbor")) {
      verifiedNeighbors.add(String(row?.bucket ?? ""));
    }
    if (sourceType === "verified-relaxed-match") {
      relaxedSources.add(String(row?.bucket ?? ""));
    }
  }

  return {
    variants: [...variants].sort(),
    stableBuckets: stableParents.size,
    verifiedNeighbors: verifiedNeighbors.size,
    relaxedSources: relaxedSources.size,
    sourceTypeCounts,
  };
}

export function createIronBenchmarkBaseline({
  datasetPath = DEFAULT_DATASET_PATH,
  datasetRows = [],
  priorityOrdering = [],
  deterministicReplay = true,
  outputPath = DEFAULT_STEP22_BENCHMARK_BASELINE_OUTPUT_PATH,
} = {}) {
  const summary = summarizeRows(datasetRows);
  return {
    dataset: datasetPath,
    variants: summary.variants,
    stableBuckets: summary.stableBuckets,
    verifiedNeighbors: summary.verifiedNeighbors,
    relaxedSources: summary.relaxedSources,
    sourceTypeCounts: summary.sourceTypeCounts,
    priorityOrdering: Array.isArray(priorityOrdering) ? priorityOrdering : [],
    deterministicReplay: Boolean(deterministicReplay),
    promotionEnabled: false,
    promoted: false,
    routingChanged: false,
    outputPath,
  };
}

export async function writeIronBenchmarkBaseline({
  datasetPath = DEFAULT_DATASET_PATH,
  priorityPath = DEFAULT_PRIORITY_PATH,
  determinismPath = DEFAULT_DETERMINISM_PATH,
  outputPath = DEFAULT_STEP22_BENCHMARK_BASELINE_OUTPUT_PATH,
} = {}) {
  const datasetRows = parseJsonl(await fs.readFile(datasetPath, "utf8"));
  const priorityOrdering = JSON.parse(await fs.readFile(priorityPath, "utf8"));
  const determinism = JSON.parse(await fs.readFile(determinismPath, "utf8"));

  const baseline = createIronBenchmarkBaseline({
    datasetPath,
    datasetRows,
    priorityOrdering,
    deterministicReplay: determinism?.deterministic,
    outputPath,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(baseline, null, 2), "utf8");
  return baseline;
}
