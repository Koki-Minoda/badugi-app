import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import {
  countBy,
  entropyFromCounts,
  focusedObservationAxisValue,
  rowsFromFocusedReport,
  signFlipRate,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_SIGNFLIP_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-signflip-isolation-step28.json",
);

export const STEP28_SIGNFLIP_AXES = [
  "playerCount",
  "position",
  "callBand",
  "pressureFamily",
  "pressureChain",
  "stackDepth",
  "drawRound",
  "bettingRound",
  "handClassStrength",
  "toCallRatio",
  "potOddsBand",
];

async function loadFocusedReport() {
  try {
    return JSON.parse(await fs.readFile(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return runFocusedS02Counterfactual({ runReplay: false });
  }
}

function verdictFor({ sample, signFlip, entropy }) {
  if (sample < 10) return "LOW_SAMPLE";
  if (signFlip > 0.25 || entropy > 0.75) return "SIGN_FLIP_SOURCE";
  if (signFlip <= 0.1 && entropy <= 0.35) return "CLEAN";
  return "MIXED";
}

export function isolateS02SignFlipSources({ focusedReport = null, rows = null } = {}) {
  const inputRows = rows ?? rowsFromFocusedReport(focusedReport ?? {});
  const table = [];
  for (const axis of STEP28_SIGNFLIP_AXES) {
    const groups = new Map();
    inputRows.forEach((row) => {
      const bucket = focusedObservationAxisValue(row, axis);
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(row);
    });
    [...groups.entries()].forEach(([bucket, group]) => {
      const signFlip = signFlipRate(group.map((row) => row.delta));
      const entropy = entropyFromCounts(countBy(group, (row) => (Number(row.delta) > 0 ? "positive" : Number(row.delta) < 0 ? "negative" : "zero")));
      table.push({
        axis,
        bucket,
        sample: group.length,
        signFlipRate: signFlip,
        entropy,
        verdict: verdictFor({ sample: group.length, signFlip, entropy }),
      });
    });
  }
  table.sort((left, right) => right.signFlipRate - left.signFlipRate || right.sample - left.sample);
  return {
    generatedAt: new Date().toISOString(),
    bucket: focusedReport?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    rows: table,
    topSources: table.filter((row) => row.verdict === "SIGN_FLIP_SOURCE").slice(0, 10),
    outputPath: DEFAULT_STEP28_SIGNFLIP_OUTPUT_PATH,
  };
}

export async function writeS02SignFlipIsolation({
  outputPath = DEFAULT_STEP28_SIGNFLIP_OUTPUT_PATH,
  ...input
} = {}) {
  const focusedReport = input.focusedReport ?? (input.rows ? null : await loadFocusedReport());
  const report = isolateS02SignFlipSources({ ...input, focusedReport });
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02SignFlipIsolation();
  console.log(JSON.stringify(report, null, 2));
}
