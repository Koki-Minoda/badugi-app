import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP18_PLAYERCOUNT_AUDIT_PATH = path.resolve(
  "reports/ai-iron/playercount-definition-audit-step18.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return content
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
    .filter(Boolean);
}

function summarizeCorpusPlayerCount(samples = []) {
  const counts = {};
  for (const sample of samples) {
    const value = String(sample.playerCount ?? "unknown");
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export async function auditPlayerCountDefinitions({
  corpusPaths = [
    path.resolve("reports/ai-eval/divergence-replay-samples/iron-step17-s02-20260707.jsonl"),
    path.resolve("reports/ai-eval/divergence-replay-samples/iron-step17-s02-20260708.jsonl"),
    path.resolve("reports/ai-eval/divergence-replay-samples/iron-step17-s02-20260709.jsonl"),
  ],
  arenaOpportunityPath = path.resolve("reports/ai-iron/s02-playercount-opportunity-step17.json"),
  decisionTracePath = path.resolve("reports/ai-iron/s02-decision-timing-trace-step18.jsonl"),
  outputPath = DEFAULT_STEP18_PLAYERCOUNT_AUDIT_PATH,
} = {}) {
  const corpusSamples = (
    await Promise.all(corpusPaths.map((filePath) => readJsonl(filePath)))
  ).flat();
  const arenaSummary = await readJson(arenaOpportunityPath);
  const timingTrace = await readJsonl(decisionTracePath);

  const report = {
    variant: "S02",
    corpusPlayerCount: summarizeCorpusPlayerCount(corpusSamples),
    arenaPlayerCount: arenaSummary.playerCountArena ?? {},
    reconciledPlayerCount: arenaSummary.playerCountReconciled ?? {},
    activePlayersAtHandStart: arenaSummary.activePlayersAtHandStart ?? {},
    activePlayersAtDecision: arenaSummary.activePlayersAtDecision ?? {},
    strongSDA5ByPlayerCount: arenaSummary.strongSDA5ByPlayerCount ?? {},
    strongSDA5ByArenaPlayerCount: arenaSummary.strongSDA5ByArenaPlayerCount ?? {},
    timingSamples: timingTrace.slice(0, 50),
    divergenceSummary: {
      corpusThreeWayCount: Number((summarizeCorpusPlayerCount(corpusSamples) ?? {})["3"] ?? 0),
      arenaThreeWayCount: Number((arenaSummary.playerCountArena ?? {})["3"] ?? 0),
      reconciledThreeWayCount: Number((arenaSummary.playerCountReconciled ?? {})["3"] ?? 0),
    },
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return { outputPath, report };
}
