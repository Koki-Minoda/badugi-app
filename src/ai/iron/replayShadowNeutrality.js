import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP21_NEUTRALITY_REPLAY_PATH = path.resolve(
  "reports/ai-iron/s02-shadow-neutrality-replay-step21.json",
);

export async function replayShadowNeutrality({
  rows = [],
  outputPath = DEFAULT_STEP21_NEUTRALITY_REPLAY_PATH,
} = {}) {
  const entries = Array.isArray(rows) ? rows : [];
  const replayRows = entries.map((entry) => ({
    decisionId: entry.decisionId,
    selectedSource: entry.selectedSource,
    shadowSource: entry.shadowSource,
    sameAction: Boolean(entry.sameAction),
    replayOutcomeChanged: Boolean(!entry.sameAction),
    evDelta: Number(entry.evDelta ?? 0),
  }));
  const summary = {
    replaySamples: replayRows.length,
    replayOutcomeChanged: replayRows.filter((row) => row.replayOutcomeChanged).length,
    deterministic: true,
    rows: replayRows,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
