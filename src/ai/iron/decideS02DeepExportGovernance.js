import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP36_EXPORT_GOVERNANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-export-governance-step36.json",
);
export const DEFAULT_STEP36_NARROW_CANDIDATES_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-narrow-candidates-step36.json",
);
export const DEFAULT_STEP36_CROSSBUCKET_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-crossbucket-stability-step36.json",
);
export const DEFAULT_STEP36_ENTROPY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-entropy-step36.json",
);
export const DEFAULT_STEP36_DETERMINISM_INPUT_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-step36.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function decide({ candidates = [], crossBucket = {}, entropy = {}, determinism = {} } = {}) {
  const exportable = candidates.filter((candidate) => candidate.verdict === "EXPORTABLE_CANDIDATE");
  if (!determinism.deterministic || Number(determinism.invalidReplayCount ?? 0) > 0) return "COUNTERFACTUAL_ONLY";
  if (crossBucket.consistency === "INCONSISTENT") return "DO_NOT_EXPORT";
  if (entropy.classification === "HIGH_ENTROPY") return "COUNTERFACTUAL_ONLY";
  if (exportable.length && crossBucket.consistency !== "INCONSISTENT") return "SAFE_TO_EXPORT_NEXT";
  if (candidates.some((candidate) => candidate.verdict === "COUNTERFACTUAL_ONLY")) return "COUNTERFACTUAL_ONLY";
  return "MONITOR_ONLY";
}

export function decideS02DeepExportGovernance({
  candidateReport = {},
  crossBucketReport = {},
  entropyReport = {},
  determinismReport = {},
  outputPath = DEFAULT_STEP36_EXPORT_GOVERNANCE_OUTPUT_PATH,
} = {}) {
  const candidates = candidateReport.candidates ?? [];
  const exportableCandidates = candidates.filter((candidate) => candidate.verdict === "EXPORTABLE_CANDIDATE");
  const decision = decide({
    candidates,
    crossBucket: crossBucketReport,
    entropy: entropyReport,
    determinism: determinismReport,
  });
  return {
    generatedAt: new Date().toISOString(),
    candidate: "S02 deep RAISE vs CHECK",
    decision,
    exportableCandidates: exportableCandidates.map((candidate) => candidate.candidate),
    crossBucketConsistency: crossBucketReport.consistency ?? "UNKNOWN",
    entropyClassification: entropyReport.classification ?? "UNKNOWN",
    deterministicReplay: Boolean(determinismReport.deterministic),
    reason: [
      ...(exportableCandidates.length ? [] : ["no-stable-narrow-candidate"]),
      ...(crossBucketReport.consistency === "INCONSISTENT" ? ["cross-bucket-inconsistent"] : []),
      ...(entropyReport.classification === "HIGH_ENTROPY" ? ["high-entropy-source"] : []),
      ...(!determinismReport.deterministic ? ["determinism-not-confirmed"] : []),
      ...(Number(determinismReport.invalidReplayCount ?? 0) > 0 ? ["invalid-replay"] : []),
    ],
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeS02DeepExportGovernance({
  candidatePath = DEFAULT_STEP36_NARROW_CANDIDATES_INPUT_PATH,
  crossBucketPath = DEFAULT_STEP36_CROSSBUCKET_INPUT_PATH,
  entropyPath = DEFAULT_STEP36_ENTROPY_INPUT_PATH,
  determinismPath = DEFAULT_STEP36_DETERMINISM_INPUT_PATH,
  outputPath = DEFAULT_STEP36_EXPORT_GOVERNANCE_OUTPUT_PATH,
  candidateReport,
  crossBucketReport,
  entropyReport,
  determinismReport,
} = {}) {
  const candidates = candidateReport ?? (await readJsonIfExists(candidatePath));
  const crossBucket = crossBucketReport ?? (await readJsonIfExists(crossBucketPath));
  const entropy = entropyReport ?? (await readJsonIfExists(entropyPath));
  const determinism = determinismReport ?? (await readJsonIfExists(determinismPath));
  return writeJsonReport(
    outputPath,
    decideS02DeepExportGovernance({
      candidateReport: candidates ?? {},
      crossBucketReport: crossBucket ?? {},
      entropyReport: entropy ?? {},
      determinismReport: determinism ?? {},
      outputPath,
    }),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepExportGovernance();
  console.log(JSON.stringify(report, null, 2));
}
