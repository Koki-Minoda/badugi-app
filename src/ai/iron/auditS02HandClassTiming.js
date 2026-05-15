import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP19_HANDCLASS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-handclass-timing-step19.json",
);

function summarizeCounts(values = []) {
  const counts = {};
  for (const value of values) {
    const key = String(value ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function auditS02HandClassTiming({
  corpusPaths = [],
  arenaNearMissPath,
  outputPath = DEFAULT_STEP19_HANDCLASS_OUTPUT_PATH,
} = {}) {
  const corpusRows = [];
  for (const corpusPath of corpusPaths) {
    const content = await fs.readFile(corpusPath, "utf8").catch(() => "");
    if (!content.trim()) continue;
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (String(row?.variantId ?? "").toUpperCase() !== "S02") continue;
        corpusRows.push(row);
      } catch {
        // ignore malformed lines
      }
    }
  }

  const arenaRows = (await fs.readFile(arenaNearMissPath, "utf8").catch(() => ""))
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
    variant: "S02",
    corpusHandClasses: summarizeCounts(corpusRows.map((row) => row.handClass)),
    arenaHandClasses: summarizeCounts(arenaRows.map((row) => row.handClass)),
    corpusStrongSDA5: corpusRows.filter((row) => row.handClass === "strongSDA5").length,
    arenaStrongSDA5: arenaRows.filter((row) => row.handClass === "strongSDA5").length,
    conclusion:
      corpusRows.filter((row) => row.handClass === "strongSDA5").length >
      arenaRows.filter((row) => row.handClass === "strongSDA5").length
        ? "arena scarcity dominates; no separate timing mutation applied"
        : "hand class timing aligned",
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
