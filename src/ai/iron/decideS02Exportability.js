import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_ENTROPY_OUTPUT_PATH } from "./auditS02EntropySources.js";
import { DEFAULT_STEP28_REPAIR_OUTPUT_PATH } from "./auditS02RepairDependency.js";
import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import { DEFAULT_STEP28_ISOLATED_SUBBUCKETS_OUTPUT_PATH } from "./searchS02IsolatedSubBuckets.js";
import {
  DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH,
  DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH,
} from "./runForcedActionReplay.js";
import { writeStep28Report } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_EXPORTABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-exportability-decision-step28.json",
);
export const DEFAULT_STEP29_EXPORTABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-exportability-decision-step29.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function decide({ focused, entropy, repair, subBuckets }) {
  const exportableSubBuckets = (subBuckets?.subBuckets ?? []).filter((row) => row.verdict === "EXPORTABLE_CANDIDATE");
  const blockers = [];
  if (!focused?.deterministicReplay) blockers.push("non-deterministic-or-invalid-replay");
  if (Number(focused?.meanDelta ?? 0) <= 0) blockers.push("no-positive-ev-stability");
  if (Number(focused?.signFlipRate ?? 1) > 0.1) blockers.push("signFlip-too-high");
  if (
    Number(focused?.entropyScore ?? 1) > 0.35 ||
    ["HIGH_ENTROPY", "UNEXPORTABLE"].includes(String(entropy?.classification ?? ""))
  ) {
    blockers.push("entropy-too-high");
  }
  if (Number(focused?.repairRate ?? 1) > 0.1 || !["SAFE", undefined].includes(repair?.verdict)) blockers.push("repair-dependency-risk");
  if (!exportableSubBuckets.length) blockers.push("no-isolated-exportable-sub-bucket");
  if (!blockers.length) return { decision: "EXPORTABLE", blockers, exportableSubBuckets };
  if (focused?.sampleCount >= 10 && Number(focused?.invalidReplayCount ?? 0) === 0) {
    return { decision: "COUNTERFACTUAL_ONLY", blockers, exportableSubBuckets };
  }
  return { decision: "DO_NOT_TOUCH", blockers, exportableSubBuckets };
}

export async function decideS02Exportability({
  focusedReport = null,
  entropyReport = null,
  repairReport = null,
  subBucketReport = null,
  forcedReplayReport = null,
} = {}) {
  const focused =
    focusedReport ??
    forcedReplayReport ??
    (await readJsonIfExists(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH)) ??
    (await runFocusedS02Counterfactual({ runReplay: false }));
  const entropy = entropyReport ?? (await readJsonIfExists(DEFAULT_STEP28_ENTROPY_OUTPUT_PATH));
  const repair = repairReport ?? (await readJsonIfExists(DEFAULT_STEP28_REPAIR_OUTPUT_PATH));
  const subBuckets = subBucketReport ?? (await readJsonIfExists(DEFAULT_STEP28_ISOLATED_SUBBUCKETS_OUTPUT_PATH));
  const result = decide({ focused, entropy, repair, subBuckets });
  return {
    generatedAt: new Date().toISOString(),
    bucket: focused.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    decision: result.decision,
    reason: result.blockers.length ? result.blockers.join(", ") : "low entropy, low signFlip, low repair dependency, deterministic replay, positive EV stability",
    blockers: result.blockers,
    metrics: {
      sampleCount: focused.sampleCount,
      meanDelta: focused.meanDelta,
      confidence: focused.confidence,
      signFlipRate: focused.signFlipRate,
      entropyScore: focused.entropyScore,
      repairRate: focused.repairRate,
      invalidReplayCount: focused.invalidReplayCount,
      deterministicReplay: focused.deterministicReplay,
      entropyClassification: entropy?.classification ?? null,
      repairVerdict: repair?.verdict ?? null,
      exportableSubBucketCount: result.exportableSubBuckets.length,
    },
    outputPath: DEFAULT_STEP28_EXPORTABILITY_OUTPUT_PATH,
  };
}

function decideForcedReplay({ forcedReplay, entropy, repair, subBuckets }) {
  const exportableSubBuckets = (subBuckets?.subBuckets ?? []).filter((row) => row.verdict === "EXPORTABLE_CANDIDATE");
  const blockers = [];
  if (!forcedReplay?.forcedReplayValid) blockers.push("forced-replay-invalid");
  if (Number(forcedReplay?.sampleCount ?? 0) < 30) blockers.push("sample-too-low");
  if (Number(forcedReplay?.invalidReplays ?? forcedReplay?.invalidReplayCount ?? 1) !== 0) blockers.push("invalid-replay-present");
  if (Number(forcedReplay?.signFlipRate ?? 1) > 0.1) blockers.push("signFlip-too-high");
  if (Number(forcedReplay?.confidence ?? 0) < 0.8) blockers.push("confidence-too-low");
  if (Number(forcedReplay?.repairRate ?? 1) > 0.1) blockers.push("repair-dependency-risk");
  if (Number(forcedReplay?.meanDelta ?? 0) <= 0) blockers.push("no-positive-ev-stability");
  const entropyAcceptable = !["HIGH_ENTROPY", "UNEXPORTABLE"].includes(String(entropy?.classification ?? ""));
  if (!entropyAcceptable && !exportableSubBuckets.length) blockers.push("entropy-not-isolated");
  if (!blockers.length) return { decision: "EXPORTABLE", blockers, exportableSubBuckets };
  if (Number(forcedReplay?.validReplays ?? 0) > 0 && Number(forcedReplay?.invalidReplays ?? 0) === 0) {
    return { decision: "COUNTERFACTUAL_ONLY", blockers, exportableSubBuckets };
  }
  return { decision: "DO_NOT_TOUCH", blockers, exportableSubBuckets };
}

export async function decideS02ForcedReplayExportability({
  forcedReplayReport = null,
  entropyReport = null,
  repairReport = null,
  subBucketReport = null,
} = {}) {
  const forcedReplay = forcedReplayReport ?? (await readJsonIfExists(DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH));
  const entropy = entropyReport ?? (await readJsonIfExists(DEFAULT_STEP28_ENTROPY_OUTPUT_PATH));
  const repair = repairReport ?? (await readJsonIfExists(DEFAULT_STEP28_REPAIR_OUTPUT_PATH));
  const subBuckets = subBucketReport ?? (await readJsonIfExists(DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH));
  const result = decideForcedReplay({ forcedReplay, entropy, repair, subBuckets });
  return {
    generatedAt: new Date().toISOString(),
    bucket: forcedReplay?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    decision: result.decision,
    reason: result.blockers.length ? result.blockers.join(", ") : "forced replay stable and isolated",
    blockers: result.blockers,
    metrics: {
      forcedReplayValid: Boolean(forcedReplay?.forcedReplayValid),
      sampleCount: forcedReplay?.sampleCount ?? 0,
      validReplays: forcedReplay?.validReplays ?? 0,
      invalidReplays: forcedReplay?.invalidReplays ?? 0,
      meanDelta: forcedReplay?.meanDelta ?? 0,
      medianDelta: forcedReplay?.medianDelta ?? 0,
      confidence: forcedReplay?.confidence ?? 0,
      signFlipRate: forcedReplay?.signFlipRate ?? 1,
      repairRate: forcedReplay?.repairRate ?? 1,
      deterministicReplay: Boolean(forcedReplay?.deterministicReplay),
      entropyClassification: entropy?.classification ?? null,
      repairVerdict: repair?.verdict ?? null,
      exportableSubBucketCount: result.exportableSubBuckets.length,
    },
    outputPath: DEFAULT_STEP29_EXPORTABILITY_OUTPUT_PATH,
  };
}

export async function writeS02ExportabilityDecision({
  outputPath = DEFAULT_STEP28_EXPORTABILITY_OUTPUT_PATH,
  ...input
} = {}) {
  const report = await decideS02Exportability(input);
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const step29 = process.argv.includes("--step29");
  const report = step29
    ? await writeStep28Report(DEFAULT_STEP29_EXPORTABILITY_OUTPUT_PATH, await decideS02ForcedReplayExportability())
    : await writeS02ExportabilityDecision();
  console.log(JSON.stringify(report, null, 2));
}
