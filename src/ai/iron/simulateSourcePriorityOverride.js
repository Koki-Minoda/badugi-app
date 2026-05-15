import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP21_OVERRIDE_SIMULATION_PATH = path.resolve(
  "reports/ai-iron/s02-priority-override-simulation-step21.json",
);

export async function simulateSourcePriorityOverride({
  rows = [],
  outputPath = DEFAULT_STEP21_OVERRIDE_SIMULATION_PATH,
} = {}) {
  const entries = Array.isArray(rows) ? rows : [];
  const simulations = entries.map((entry) => ({
    decisionId: entry.decisionId,
    actualSelectedSource: entry.selectedSource,
    overrideSelectedSource: entry.shadowSource,
    sameAction: Boolean(entry.sameAction),
    wouldChangeGameplay: Boolean(!entry.sameAction),
  }));
  const summary = {
    exactOpportunities: simulations.length,
    overrideWouldChangeGameplay: simulations.filter((entry) => entry.wouldChangeGameplay).length,
    rows: simulations,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
