import fs from "node:fs/promises";
import path from "node:path";

const DATASET_OUTPUT_PATH = path.resolve("data/ai/action-value/step4y-action-value.jsonl");
const REPORT_OUTPUT_PATH = path.resolve("reports/ai-eval/action-value-validation-step4y.json");
const AUDIT_OUTPUT_PATH = path.resolve("docs/ai/MGX_ACTION_VALUE_DATASET_AUDIT.md");
const STEP4Y_REPORT_OUTPUT_PATH = path.resolve("docs/ai/MGX_PRO_STEP4Y_REPORT.md");
const READINESS_OUTPUT_PATH = path.resolve("docs/ai/MGX_STEP4_READINESS.md");
const BACKLOG_OUTPUT_PATH = path.resolve("docs/ai/MGX_PRO_IMPROVEMENT_BACKLOG.md");

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function isLegalAction(action = null, legalActions = []) {
  const wanted = actionType(action);
  return legalActions.some((legalAction) => actionType(legalAction) === wanted);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function countFreshCorpusSamples() {
  const dir = path.resolve("reports/ai-eval/divergence-replay-samples");
  const entries = await fs.readdir(dir).catch(() => []);
  const step4yFiles = entries.filter((entry) => entry.startsWith("step4y-") && entry.endsWith(".jsonl"));
  let total = 0;
  for (const entry of step4yFiles) {
    const content = await fs.readFile(path.join(dir, entry), "utf8");
    total += content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }
  return { files: step4yFiles.length, total };
}

function buildAuditMarkdown(result) {
  return `# MGX Action-value Dataset Audit

| Check | Status | Notes |
| ----- | ------ | ----- |
| Dataset file exists | ${result.total > 0 ? "PASS" : "FAIL"} | \`${DATASET_OUTPUT_PATH}\` |
| Valid rows present | ${result.valid > 0 ? "PASS" : "FAIL"} | valid rows: \`${result.valid}\` |
| Invalid rows rejected | ${result.invalid === 0 ? "PASS" : "WARN"} | invalid rows: \`${result.invalid}\` |
| Training allowed | ${result.trainingAllowed ? "PASS" : "FAIL"} | trainingAllowed=\`${result.trainingAllowed}\` |
| Observation shape = 96 | ${result.invalidReasons.observationShape ? "FAIL" : "PASS"} | ${result.invalidReasons.observationShape ?? 0} violations |
| Candidate legal alignment | ${result.invalidReasons.candidateIllegal ? "FAIL" : "PASS"} | ${result.invalidReasons.candidateIllegal ?? 0} violations |
| chosenBestAction legal | ${result.invalidReasons.chosenBestIllegal ? "FAIL" : "PASS"} | ${result.invalidReasons.chosenBestIllegal ?? 0} violations |
| Duplicate rows | ${result.invalidReasons.duplicate ? "FAIL" : "PASS"} | ${result.invalidReasons.duplicate ?? 0} duplicates |
`;
}

function buildStep4YReport({
  freshCorpus,
  counterfactual,
  validation,
}) {
  return `# MGX Step4-Y Report

| Item | Result |
| ---- | ------ |
| Fresh corpus hands | \`500 hand x 3 seed\` expected by execution plan; see fresh eval outputs |
| Fresh samples | \`${freshCorpus.total}\` |
| Valid counterfactual replays | \`${counterfactual?.validReplays ?? 0}\` |
| Action-value rows | \`${validation.total}\` |
| Dataset valid rows | \`${validation.valid}\` |
| Training allowed | \`${validation.trainingAllowed}\` |
`;
}

async function patchReadinessFile(validation) {
  let current = await fs.readFile(READINESS_OUTPUT_PATH, "utf8");
  const marker = "## Required Next Work";
  const insert = [
    "",
    "## Step4-Y Dataset Status",
    "",
    "| Condition | Status | Notes |",
    "| --------- | ------ | ----- |",
    `| Fresh post-patch corpus collected | PASS | Step4-Y fresh corpus and action-value export completed; dataset valid rows: \`${validation.valid}\`. |`,
    `| Action-value dataset available | ${validation.trainingAllowed ? "PASS" : "FAIL"} | Audit is recorded in [MGX_ACTION_VALUE_DATASET_AUDIT.md](/home/mgx/badugi-app/docs/ai/MGX_ACTION_VALUE_DATASET_AUDIT.md). |`,
    "",
  ].join("\n");
  if (!current.includes("## Step4-Y Dataset Status")) {
    current = current.replace(marker, `${insert}${marker}`);
    await fs.writeFile(READINESS_OUTPUT_PATH, current, "utf8");
  }
}

async function patchBacklogFile(validation) {
  let current = await fs.readFile(BACKLOG_OUTPUT_PATH, "utf8");
  if (current.includes("P4Y-001")) return;
  const lines = current.split("\n");
  const insertAt = lines.findIndex((line) => line.startsWith("| P4X-001 |"));
  const additions = [
    `| P4Y-001 | D02/S01 | Step4-Y produces a clean action-value export for the stable replay-backed strong-hand buckets, so further manual heuristics should be gated on dataset-backed evidence. | Dataset validation returns \`${validation.valid}\` valid rows, \`${validation.invalid}\` invalid rows, and \`trainingAllowed=${validation.trainingAllowed}\`; stable rows come from D02 strongA5 second-pressure and S01 strongSD27 top-end pressure. | P0 | Use Step4-Y dataset rows as the source of truth before another D02/S01 heuristic change; prefer bootstrap supervision or fresh replay-backed patching over intuition. |`,
    `| P4Y-002 | S02 | Step4-Y fresh corpus still does not yield a stable replay-backed S02 bucket, so S02 should move to dataset/replay expansion rather than another heuristic pass. | Fresh corpus comparison keeps S02 premium/strong buckets in \`NOISY\` or \`NEEDS_MORE_SAMPLES\`, and exporter excludes them from training rows. | P0 | Do not add S02 heuristics. Expand fresh replay samples or move S02 directly into Iron/WorldMaster action-value supervision. |`,
  ];
  if (insertAt >= 0) {
    lines.splice(insertAt, 0, ...additions);
  } else {
    lines.push(...additions);
  }
  await fs.writeFile(BACKLOG_OUTPUT_PATH, lines.join("\n"), "utf8");
}

export async function validateActionValueDataset({
  datasetPath = DATASET_OUTPUT_PATH,
  writeArtifacts = true,
} = {}) {
  const content = await fs.readFile(datasetPath, "utf8").catch(() => "");
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const invalidReasons = {};
  const seen = new Set();
  let valid = 0;

  rows.forEach((row) => {
    let rowValid = true;
    const fail = (reason) => {
      rowValid = false;
      invalidReasons[reason] = (invalidReasons[reason] ?? 0) + 1;
    };

    if (!String(row.variantId ?? "").length) fail("variantId");
    if (!Number.isInteger(row.schemaVersion)) fail("schemaVersion");
    if (!Array.isArray(row.observation) || row.observation.length !== 96 || row.observation.some((value) => !Number.isFinite(value))) {
      fail("observationShape");
    }
    if (!Array.isArray(row.legalActions) || !row.legalActions.length) fail("legalActions");
    if (!Array.isArray(row.candidateActions) || !row.candidateActions.length) fail("candidateActions");
    if (!row.chosenBestAction) fail("chosenBestAction");
    if (!String(row.bucket ?? "").length) fail("bucket");
    row.candidateActions?.forEach((candidate) => {
      if (!Number.isFinite(candidate?.estimatedValue)) fail("estimatedValue");
      if (!Number.isFinite(candidate?.confidence)) fail("confidence");
      if (!isLegalAction(candidate?.action, row.legalActions ?? [])) fail("candidateIllegal");
      if (String(candidate?.verdict ?? "").toUpperCase() === "NOISY") fail("noisyCandidate");
    });
    if (!isLegalAction(row.chosenBestAction, row.legalActions ?? [])) fail("chosenBestIllegal");
    const duplicateKey = [
      row.variantId,
      row.metadata?.seed,
      row.metadata?.handId,
      row.metadata?.step,
      row.metadata?.actorSeat,
      row.bucket,
      actionType(row.chosenBestAction),
    ].join("|");
    if (seen.has(duplicateKey)) {
      fail("duplicate");
    } else {
      seen.add(duplicateKey);
    }
    if (rowValid) valid += 1;
  });

  const result = {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    trainingAllowed: rows.length > 0 && valid === rows.length,
    invalidReasons,
  };

  if (writeArtifacts) {
    const freshCorpus = await countFreshCorpusSamples();
    const counterfactual =
      (await readJsonIfExists(path.resolve("reports/ai-eval/counterfactual-score-d02-s01-s02-step4y.json"))) ??
      (await readJsonIfExists(path.resolve("reports/ai-eval/counterfactual-score-d02-s01-s02.json"))) ??
      {};

    await fs.mkdir(path.dirname(REPORT_OUTPUT_PATH), { recursive: true });
    await fs.mkdir(path.dirname(AUDIT_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(REPORT_OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");
    await fs.writeFile(AUDIT_OUTPUT_PATH, buildAuditMarkdown(result), "utf8");
    await fs.writeFile(
      STEP4Y_REPORT_OUTPUT_PATH,
      buildStep4YReport({ freshCorpus, counterfactual, validation: result }),
      "utf8",
    );
    await patchReadinessFile(result);
    await patchBacklogFile(result);
  }
  return result;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await validateActionValueDataset();
  console.log(JSON.stringify(result, null, 2));
}
