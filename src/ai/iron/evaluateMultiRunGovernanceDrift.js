import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP25_GOVERNANCE_DRIFT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step25-governance-drift.json",
);

function trailingCount(history = [], predicate = () => false) {
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (!predicate(history[index])) break;
    count += 1;
  }
  return count;
}

export function evaluateMultiRunGovernanceDrift({ history = [], rollingBaseline = {} } = {}) {
  const entries = Array.isArray(history) ? history : [];
  const deterministicFailure = entries.some((entry) => entry?.deterministicReplay === false);
  const sameActionDegradedRuns = entries.filter((entry) => Number(entry?.sameActionRate ?? 1) < 0.99).length;
  const negativeIronProRuns = entries.filter((entry) =>
    Object.values(entry?.ironProGap ?? {}).some((value) => Number(value ?? 0) < 0),
  ).length;
  const trailingWarns = trailingCount(entries, (entry) => String(entry?.hardenedStatus ?? entry?.rawStatus ?? "") === "WARN");

  let status = "PASS";
  const reasons = [];
  if (deterministicFailure || sameActionDegradedRuns >= 3 || negativeIronProRuns >= 3) {
    status = "FAIL";
    if (deterministicFailure) reasons.push("deterministicReplay=false observed");
    if (sameActionDegradedRuns >= 3) reasons.push("sameActionRate degradation across >=3 runs");
    if (negativeIronProRuns >= 3) reasons.push("Iron-Pro gap negative across >=3 runs");
  } else if (
    trailingWarns > 0 ||
    Number(rollingBaseline?.rollingDatasetHitRate ?? 0) === 0
  ) {
    status = "WARN";
    if (trailingWarns > 0) reasons.push("recent WARN history present");
    if (Number(rollingBaseline?.rollingDatasetHitRate ?? 0) === 0) reasons.push("rolling dataset hit rate is zero");
  }

  return {
    status,
    sameActionDegradedRuns,
    negativeIronProRuns,
    trailingWarns,
    deterministicFailure,
    reasons,
    outputPath: DEFAULT_STEP25_GOVERNANCE_DRIFT_OUTPUT_PATH,
  };
}

export async function writeMultiRunGovernanceDrift({
  history = [],
  rollingBaseline = {},
  outputPath = DEFAULT_STEP25_GOVERNANCE_DRIFT_OUTPUT_PATH,
} = {}) {
  const report = evaluateMultiRunGovernanceDrift({ history, rollingBaseline });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
