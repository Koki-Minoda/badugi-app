import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP22_FREEZE_DECISION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/source-priority-freeze-decision-step22.json",
);

export function evaluateSourcePriorityFreezeDecision({
  sameActionRate = 0,
  differentActionRate = 0,
  meanEVDelta = 0,
  replayOutcomeChanged = 0,
  overrideWouldChangeGameplay = 0,
} = {}) {
  const freezeRecommended =
    Number(sameActionRate) >= 0.99 &&
    Number(differentActionRate) === 0 &&
    Number(meanEVDelta) === 0 &&
    Number(replayOutcomeChanged) === 0 &&
    Number(overrideWouldChangeGameplay) === 0;

  return {
    sameActionRate: Number(sameActionRate),
    differentActionRate: Number(differentActionRate),
    meanEVDelta: Number(meanEVDelta),
    replayOutcomeChanged: Number(replayOutcomeChanged),
    overrideWouldChangeGameplay: Number(overrideWouldChangeGameplay),
    freezeRecommended,
  };
}

export async function auditSourcePriorityFreezeDecision({
  neutralitySummaryPath = path.resolve("reports/ai-iron/s02-shadow-neutrality-summary-step21.json"),
  neutralityReplayPath = path.resolve("reports/ai-iron/s02-shadow-neutrality-replay-step21.json"),
  overrideSimulationPath = path.resolve("reports/ai-iron/s02-priority-override-simulation-step21.json"),
  outputPath = DEFAULT_STEP22_FREEZE_DECISION_OUTPUT_PATH,
} = {}) {
  const neutralitySummary = JSON.parse(await fs.readFile(neutralitySummaryPath, "utf8"));
  const neutralityReplay = JSON.parse(await fs.readFile(neutralityReplayPath, "utf8"));
  const overrideSimulation = JSON.parse(await fs.readFile(overrideSimulationPath, "utf8"));

  const report = evaluateSourcePriorityFreezeDecision({
    sameActionRate: neutralitySummary.sameActionRate,
    differentActionRate: neutralitySummary.differentActionRate,
    meanEVDelta: neutralitySummary.meanEVDelta,
    replayOutcomeChanged: neutralityReplay.replayOutcomeChanged,
    overrideWouldChangeGameplay: overrideSimulation.overrideWouldChangeGameplay,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
