import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { createIronCandidateMetadata } from "./createIronCandidateMetadata.js";
import { validateActionValueDataset } from "../evaluation/validateActionValueDataset.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/step4y-action-value.jsonl");
const REPORT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-warm-start-step1.json");
const METADATA_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-candidate-step1-metadata.json");
const DOC_OUTPUT_PATH = path.resolve("docs/ai/MGX_IRON_BOOTSTRAP_STEP1_REPORT.md");

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath: path.resolve(String(options.dataset ?? DEFAULT_DATASET_PATH)),
  };
}

function buildBootstrapReport({ validation, summary, warnings, candidateMetadata, datasetPath }) {
  const variantCoverage = Object.entries(summary.variantDistribution ?? {})
    .map(([variant, count]) => `${variant}:${count}`)
    .join(", ");
  return `# MGX Iron Bootstrap Step1 Report

| Item | Result |
| ---- | ------ |
| Dataset rows | \`${summary.totalRows}\` |
| Valid rows | \`${summary.validRows}\` |
| Invalid rows | \`${summary.invalidRows}\` |
| Training allowed | \`${validation.trainingAllowed}\` |
| Variant coverage | \`${variantCoverage || "none"}\` |
| Sparse warnings | \`${warnings.join(", ") || "none"}\` |
| Candidate metadata generated | \`${candidateMetadata ? "YES" : "NO"}\` |
| Promoted | NO |

## Notes

- Dataset source: \`${datasetPath}\`
- Remaining limitation: replay-derived supervision is sparse and D02-heavy.
- Next RL phase: use the candidate metadata as the gate into Iron Bootstrap Step2 supervised training hooks.
- Next dataset expansion targets: \`S01 strongSD27\`, \`S02 strongSDA5\`, and broader fresh counterfactual coverage.
- Bias warning: the current export is dominated by D02 buckets and should not mutate production routing.
`;
}

export async function trainIronWarmStart({
  datasetPath = DEFAULT_DATASET_PATH,
  reportOutputPath = REPORT_OUTPUT_PATH,
  metadataOutputPath = METADATA_OUTPUT_PATH,
  docOutputPath = DOC_OUTPUT_PATH,
} = {}) {
  const validation = await validateActionValueDataset({
    datasetPath,
    writeArtifacts: false,
  });
  const loaded = await loadActionValueDataset(datasetPath);
  const warnings = [...new Set([
    ...loaded.warnings,
    ...(validation.trainingAllowed ? [] : ["training-gate-blocked"]),
  ])];
  const candidateMetadata = validation.trainingAllowed
    ? createIronCandidateMetadata({
        datasetSource: datasetPath,
        summary: loaded.summary,
        warnings,
      })
    : null;

  const output = {
    tier: "iron-candidate",
    dataset: datasetPath,
    rows: loaded.summary.totalRows,
    validRows: loaded.summary.validRows,
    invalidRows: loaded.summary.invalidRows,
    trainingAllowed: validation.trainingAllowed,
    variantDistribution: loaded.summary.variantDistribution,
    bucketDistribution: loaded.summary.bucketDistribution,
    actionDistribution: loaded.summary.actionDistribution,
    confidenceDistribution: loaded.summary.confidenceDistribution,
    warnings,
    promoted: false,
    candidateMetadata,
  };

  await fs.mkdir(path.dirname(reportOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(metadataOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(docOutputPath), { recursive: true });
  await fs.writeFile(reportOutputPath, JSON.stringify(output, null, 2), "utf8");
  if (candidateMetadata) {
    await fs.writeFile(metadataOutputPath, JSON.stringify(candidateMetadata, null, 2), "utf8");
  }
  await fs.writeFile(
    docOutputPath,
    buildBootstrapReport({
      validation,
      summary: loaded.summary,
      warnings,
      candidateMetadata,
      datasetPath,
    }),
    "utf8",
  );

  return output;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await trainIronWarmStart(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
