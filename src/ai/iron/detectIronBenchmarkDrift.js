import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP23_DRIFT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step23-drift-detection.json",
);

export const DEFAULT_DRIFT_THRESHOLDS = {
  sameActionRateMin: 0.99,
  differentActionRateMax: 0,
  ironProGapMin: 0,
  datasetHitRateDropMax: 0.5,
  invalidReplayMax: 0,
  illegalMax: 0,
  freezeMax: 0,
  routingChangedMustBeFalse: true,
  promotedMustBeFalse: true,
};

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function averageResultMetric(results = [], key = "") {
  const entries = Array.isArray(results) ? results : [];
  return entries.length
    ? roundNumber(entries.reduce((sum, entry) => sum + Number(entry?.[key] ?? 0), 0) / entries.length)
    : 0;
}

function normalizePriorityOrder(ordering = []) {
  return (Array.isArray(ordering) ? ordering : []).map((entry) => String(entry?.sourceType ?? ""));
}

export function detectIronBenchmarkDrift({
  baseline,
  current,
  thresholds = DEFAULT_DRIFT_THRESHOLDS,
  outputPath = DEFAULT_STEP23_DRIFT_OUTPUT_PATH,
} = {}) {
  const failures = [];
  const warnings = [];
  const checks = [];

  const baselineResults = Array.isArray(baseline?.arena?.results) ? baseline.arena.results : [];
  const currentResults = Array.isArray(current?.arena?.results) ? current.arena.results : [];

  const baselineHitRate = averageResultMetric(baselineResults, "datasetHitRate");
  const currentHitRate = averageResultMetric(currentResults, "datasetHitRate");
  const datasetHitRateDrop =
    baselineHitRate > 0 ? roundNumber((baselineHitRate - currentHitRate) / baselineHitRate) : 0;

  const pushCheck = (name, status, detail) => {
    checks.push({ check: name, status, detail });
    if (status === "FAIL") failures.push(`${name}: ${detail}`);
    if (status === "WARN") warnings.push(`${name}: ${detail}`);
  };

  const freezeDecision = current?.freezeDecision ?? {};
  pushCheck(
    "sameActionRate",
    Number(freezeDecision.sameActionRate ?? 0) >= thresholds.sameActionRateMin ? "PASS" : "FAIL",
    `value=${roundNumber(freezeDecision.sameActionRate ?? 0)} min=${thresholds.sameActionRateMin}`,
  );
  pushCheck(
    "differentActionRate",
    Number(freezeDecision.differentActionRate ?? 0) <= thresholds.differentActionRateMax ? "PASS" : "FAIL",
    `value=${roundNumber(freezeDecision.differentActionRate ?? 0)} max=${thresholds.differentActionRateMax}`,
  );

  for (const result of currentResults) {
    pushCheck(
      `ironProGap:${result.variant}`,
      Number(result?.ironProGap ?? 0) >= thresholds.ironProGapMin ? "PASS" : "FAIL",
      `value=${roundNumber(result?.ironProGap ?? 0, 2)} min=${thresholds.ironProGapMin}`,
    );
    pushCheck(
      `illegal:${result.variant}`,
      Number(result?.illegal ?? 0) <= thresholds.illegalMax ? "PASS" : "FAIL",
      `value=${Number(result?.illegal ?? 0)} max=${thresholds.illegalMax}`,
    );
    pushCheck(
      `freeze:${result.variant}`,
      Number(result?.freeze ?? 0) <= thresholds.freezeMax ? "PASS" : "FAIL",
      `value=${Number(result?.freeze ?? 0)} max=${thresholds.freezeMax}`,
    );
  }

  pushCheck(
    "datasetHitRateDrop",
    datasetHitRateDrop <= thresholds.datasetHitRateDropMax ? "PASS" : "WARN",
    `baseline=${baselineHitRate} current=${currentHitRate} drop=${datasetHitRateDrop} max=${thresholds.datasetHitRateDropMax}`,
  );

  const determinism = current?.determinism ?? {};
  pushCheck(
    "deterministicReplay",
    determinism?.deterministic ? "PASS" : "FAIL",
    `value=${Boolean(determinism?.deterministic)}`,
  );
  pushCheck(
    "invalidReplayCount",
    Number(determinism?.invalidReplayCount ?? 0) <= thresholds.invalidReplayMax ? "PASS" : "FAIL",
    `value=${Number(determinism?.invalidReplayCount ?? 0)} max=${thresholds.invalidReplayMax}`,
  );

  if (thresholds.routingChangedMustBeFalse) {
    pushCheck(
      "routingChanged",
      current?.arena?.routingChanged === false ? "PASS" : "FAIL",
      `value=${Boolean(current?.arena?.routingChanged)}`,
    );
  }
  if (thresholds.promotedMustBeFalse) {
    pushCheck(
      "promoted",
      current?.arena?.promoted === false ? "PASS" : "FAIL",
      `value=${Boolean(current?.arena?.promoted)}`,
    );
  }

  const sourcePriorityBaseline = normalizePriorityOrder(baseline?.priorityOrdering);
  const sourcePriorityCurrent = normalizePriorityOrder(current?.priorityOrdering);
  pushCheck(
    "sourcePriorityOrder",
    JSON.stringify(sourcePriorityBaseline) === JSON.stringify(sourcePriorityCurrent) ? "PASS" : "FAIL",
    `baseline=${sourcePriorityBaseline.join(">")} current=${sourcePriorityCurrent.join(">")}`,
  );

  pushCheck(
    "d01Exclusion",
    current?.arena?.dryRunEligibility?.reasonD01Excluded
      ? "PASS"
      : "FAIL",
    String(current?.arena?.dryRunEligibility?.reasonD01Excluded ?? "missing"),
  );

  const status = failures.length > 0 ? "FAIL" : warnings.length > 0 ? "WARN" : "PASS";
  return {
    status,
    thresholds,
    baseline: {
      datasetHitRate: baselineHitRate,
      sourcePriorityOrder: sourcePriorityBaseline,
    },
    current: {
      datasetHitRate: currentHitRate,
      sourcePriorityOrder: sourcePriorityCurrent,
    },
    warnings,
    failures,
    checks,
    outputPath,
  };
}

export async function writeIronBenchmarkDrift({
  baseline,
  current,
  thresholds = DEFAULT_DRIFT_THRESHOLDS,
  outputPath = DEFAULT_STEP23_DRIFT_OUTPUT_PATH,
} = {}) {
  const report = detectIronBenchmarkDrift({ baseline, current, thresholds, outputPath });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
