import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP19_EXACT_MATCH_AUDIT_PATH = path.resolve(
  "reports/ai-iron/s02-exact-match-condition-audit-step19.json",
);

function summarizeCounts(values = []) {
  const counts = {};
  for (const value of values) {
    const key = String(value ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function auditS02ExactMatchConditions({
  arenaNearMissPath,
  outputPath = DEFAULT_STEP19_EXACT_MATCH_AUDIT_PATH,
} = {}) {
  const rows = (await fs.readFile(arenaNearMissPath, "utf8").catch(() => ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((row) => String(row?.variant ?? "") === "S02");

  const report = {
    targetBucket: "S02_RELAXED_V3",
    totalRows: rows.length,
    mismatchReasons: summarizeCounts(rows.map((row) => row.mismatchReason)),
    handClassArena: summarizeCounts(rows.map((row) => row.handClass)),
    playerCountArenaReconciled: summarizeCounts(rows.map((row) => row.playerCountReconciled)),
    positionArena: summarizeCounts(rows.map((row) => row.positionBand)),
    callBandArena: summarizeCounts(rows.map((row) => row.callBand)),
    pressureChainArena: summarizeCounts(rows.map((row) => row.pressureChain)),
    repeatedPressureArena: summarizeCounts(rows.map((row) => row.repeatedPressure)),
    exactOpportunityRows: rows.filter((row) => row.exactOpportunity).length,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
