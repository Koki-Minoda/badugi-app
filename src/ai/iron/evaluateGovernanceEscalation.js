import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP25_GOVERNANCE_ESCALATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step25-governance-escalation.json",
);

function trailingCount(history = [], status = "") {
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (String(history[index]?.status ?? "") !== status) break;
    count += 1;
  }
  return count;
}

export function evaluateGovernanceEscalation({ governanceHistory = [] } = {}) {
  const entries = Array.isArray(governanceHistory) ? governanceHistory : [];
  const trailingFails = trailingCount(entries, "FAIL");
  const trailingWarns = trailingCount(entries, "WARN");
  let governanceAction = "NO_ACTION";
  let reason = trailingWarns > 0 ? "single sparse WARN => NO_ACTION" : "no escalation thresholds met";
  if (trailingFails >= 3) {
    governanceAction = "ESCALATE";
    reason = "3 consecutive FAIL";
  } else if (trailingWarns >= 5) {
    governanceAction = "REVIEW";
    reason = "5 consecutive WARN";
  }
  return {
    governanceAction,
    reason,
    trailingFails,
    trailingWarns,
    outputPath: DEFAULT_STEP25_GOVERNANCE_ESCALATION_OUTPUT_PATH,
  };
}

export async function writeGovernanceEscalation({
  governanceHistory = [],
  outputPath = DEFAULT_STEP25_GOVERNANCE_ESCALATION_OUTPUT_PATH,
} = {}) {
  const report = evaluateGovernanceEscalation({ governanceHistory });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
