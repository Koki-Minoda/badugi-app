import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { STEP45_TABLE_SIZE_WEIGHTS } from "./buildNaturalMixedExposureConfig.js";

export const DEFAULT_STEP45_TABLE_DISTRIBUTION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step45-table-distribution-validation.json",
);

function addCounts(left = {}, right = {}) {
  return {
    "6max": Number(left["6max"] ?? 0) + Number(right["6max"] ?? 0),
    "4max": Number(left["4max"] ?? 0) + Number(right["4max"] ?? 0),
    "3way": Number(left["3way"] ?? 0) + Number(right["3way"] ?? 0),
  };
}

function share(counts = {}) {
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value ?? 0), 0);
  return Object.fromEntries(
    ["6max", "4max", "3way"].map((key) => [key, roundNumber(Number(counts[key] ?? 0) / Math.max(1, total), 4)]),
  );
}

export function summarizeNaturalTableDistribution({
  arena = {},
  config = {},
  tolerance = 0.03,
} = {}) {
  const expected = config.tableSizeWeights ?? arena.tableSizeWeights ?? STEP45_TABLE_SIZE_WEIGHTS;
  const counts = (arena.results ?? []).reduce(
    (total, result) => addCounts(total, result.tableSizeHandDistribution ?? {}),
    { "6max": 0, "4max": 0, "3way": 0 },
  );
  const observed = share(counts);
  const rows = ["6max", "4max", "3way"].map((tableSize) => {
    const expectedShare = Number(expected[tableSize] ?? 0);
    const observedShare = Number(observed[tableSize] ?? 0);
    return {
      tableSize,
      configShare: roundNumber(expectedShare, 4),
      observedShare,
      delta: roundNumber(observedShare - expectedShare, 4),
      withinTolerance: Math.abs(observedShare - expectedShare) <= tolerance,
    };
  });
  const missing = rows.filter((row) => row.observedShare <= 0).map((row) => row.tableSize);
  const outsideTolerance = rows.filter((row) => !row.withinTolerance).map((row) => row.tableSize);
  const status = missing.length ? "FAIL" : outsideTolerance.length ? "WARN" : "PASS";
  return {
    generatedAt: new Date().toISOString(),
    status,
    reason: missing.length
      ? [`missing-table-size:${missing.join(",")}`]
      : outsideTolerance.length
        ? [`share-outside-tolerance:${outsideTolerance.join(",")}`]
        : ["table-distribution-matches-config"],
    tolerance,
    counts,
    expected,
    observed,
    rows,
    usesSyntheticInjection: false,
    usesHiddenStateMutation: false,
    usesGameplayMutation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function validateNaturalTableDistribution({
  arenaPath = path.resolve("reports/ai-iron/iron-step45-natural-mixed-arena.json"),
  configPath = path.resolve("reports/ai-iron/step45-natural-exposure-config.json"),
  outputPath = DEFAULT_STEP45_TABLE_DISTRIBUTION_OUTPUT_PATH,
  arena = null,
  config = null,
} = {}) {
  const report = summarizeNaturalTableDistribution({
    arena: arena ?? (await readJson(arenaPath)),
    config: config ?? (await readJson(configPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await validateNaturalTableDistribution();
  console.log(JSON.stringify(report, null, 2));
}
