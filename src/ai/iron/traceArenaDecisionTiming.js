import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP18_DECISION_TIMING_TRACE_PATH = path.resolve(
  "reports/ai-iron/s02-decision-timing-trace-step18.jsonl",
);

export async function writeArenaDecisionTimingTrace({
  profiles = [],
  outputPath = DEFAULT_STEP18_DECISION_TIMING_TRACE_PATH,
} = {}) {
  const content = profiles
    .map((profile) =>
      JSON.stringify({
        decisionId: profile.decisionId,
        variant: profile.variant,
        handClass: profile.handClass,
        playerCountCorpus: profile.playerCountReconciled ?? profile.playerCount,
        playerCountArena: profile.playerCountArena ?? profile.playerCount,
        activePlayersAtHandStart: profile.activePlayersAtHandStart,
        activePlayersAtDecision: profile.activePlayersAtDecision,
        activeNonFoldedPlayers: profile.activeNonFoldedPlayers,
        activeNonAllInPlayers: profile.activeNonAllInPlayers,
        eligibleDecisionPlayers: profile.bettingParticipantsCount,
        potEligiblePlayers: profile.potContributorsCount,
        foldedPlayers: profile.foldedPlayers ?? [],
        allInPlayers: profile.allInPlayers ?? [],
        timingStage: profile.exactOpportunity ? "post-bucket-classification" : "pre-bucket-classification",
        decisionTimingReason: profile.mismatchReason,
      }),
    )
    .join("\n");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content ? `${content}\n` : "", "utf8");
  return { outputPath };
}
