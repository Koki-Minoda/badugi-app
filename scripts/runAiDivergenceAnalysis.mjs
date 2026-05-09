import fs from "node:fs/promises";
import path from "node:path";

import { AI_EVAL_REPORT_DIR } from "../src/ai/evaluation/runAiEvaluationBatch.js";
import { analyzeActionDivergence } from "../src/ai/evaluation/analyzeActionDivergence.js";

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = ""] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    files:
      typeof options.files === "string" && options.files.trim().length
        ? options.files.split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
  };
}

async function resolveFiles(files = []) {
  if (files.length) return files;
  const entries = await fs.readdir(AI_EVAL_REPORT_DIR);
  return entries
    .filter((entry) => entry.startsWith("pro-vs-standard-") && entry.endsWith(".json"))
    .map((entry) => path.join(AI_EVAL_REPORT_DIR, entry))
    .sort()
    .slice(-3);
}

const { files } = parseArgs(process.argv.slice(2));
const targets = await resolveFiles(files);
const variants = {};
for (const file of targets) {
  const report = JSON.parse(await fs.readFile(file, "utf8"));
  for (const [variantId, result] of Object.entries(report.variants ?? {})) {
    if (!variants[variantId]) variants[variantId] = { analysis: { divergenceRecords: [] } };
    variants[variantId].analysis.divergenceRecords.push(...(result.analysis?.divergenceRecords ?? []));
  }
}
const summary = analyzeActionDivergence({ variants });
console.log(
  JSON.stringify(
    {
      files: targets,
      divergenceCount: summary.divergenceCount,
      top: summary.ranked.slice(0, 20),
    },
    null,
    2,
  ),
);
