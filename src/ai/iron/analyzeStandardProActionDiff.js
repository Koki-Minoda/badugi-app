import path from "node:path";

import {
  aggregateBy,
  loadStep27Evidence,
  roundNumber,
  sum,
  writeJsonReport,
} from "./coverageAuditUtils.js";

export const DEFAULT_STEP27_STANDARD_PRO_ACTION_DIFF_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/standard-pro-action-diff-step27.json",
);

const TRACKED_PAIRS = new Set([
  "CALL/FOLD",
  "CHECK/BET",
  "FOLD/CALL",
  "CALL/RAISE",
  "BET/CHECK",
]);

function interpretation(entry = {}) {
  const pair = `${entry.standardAction}/${entry.proAction}`;
  if (pair === "CALL/FOLD") return "Standard continues where Pro folds";
  if (pair === "CHECK/BET") return "Standard pot-controls where Pro bets";
  if (pair === "FOLD/CALL") return "Standard avoids Pro call";
  if (pair === "CALL/RAISE") return "Standard flattens Pro raise";
  if (pair === "BET/CHECK") return "Standard value/protection bet over Pro check";
  return "tracked action divergence";
}

export function analyzeStandardProActionDiff({
  divergenceRows = [],
  topN = 30,
} = {}) {
  const filtered = divergenceRows.filter((row) => TRACKED_PAIRS.has(`${row.standardAction}/${row.proAction}`));
  const grouped = aggregateBy(
    filtered,
    (row) => `${row.variantId}|${row.bucketFamily}|${row.standardAction}|${row.proAction}`,
  );
  const actionDiffs = [...grouped.values()]
    .map((rows) => {
      const first = rows[0] ?? {};
      const freq = sum(rows.map((row) => row.frequency));
      const evDelta = sum(rows.map((row) => Number(row.standardAdvantage ?? 0) * Number(row.frequency ?? 0))) / Math.max(1, freq);
      return {
        variant: first.variantId,
        bucket: first.bucketFamily,
        standardAction: first.standardAction,
        proAction: first.proAction,
        freq,
        evDelta: roundNumber(evDelta, 4),
        interpretation: interpretation(first),
      };
    })
    .sort((left, right) => right.freq * Math.abs(right.evDelta) - left.freq * Math.abs(left.evDelta))
    .slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    trackedPairs: Array.from(TRACKED_PAIRS).sort(),
    actionDiffs,
    promoted: false,
    routingChanged: false,
    outputPath: DEFAULT_STEP27_STANDARD_PRO_ACTION_DIFF_OUTPUT_PATH,
  };
}

export async function writeStandardProActionDiff({
  outputPath = DEFAULT_STEP27_STANDARD_PRO_ACTION_DIFF_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.divergenceRows ? input : await loadStep27Evidence();
  const report = analyzeStandardProActionDiff(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeStandardProActionDiff();
  console.log(JSON.stringify(report, null, 2));
}
