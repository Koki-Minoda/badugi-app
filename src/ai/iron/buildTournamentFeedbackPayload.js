import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";
import { readJsonl } from "./buildRLSignalPreview.js";
import { generateCoachingFeedbackDraftSummary } from "./generateCoachingFeedbackDraft.js";

export const DEFAULT_STEP47_TOURNAMENT_FEEDBACK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-tournament-feedback-payload.json",
);

function worstLeakCandidate(candidates = []) {
  return [...candidates].sort((a, b) => Number(b.estimatedEVGain ?? 0) - Number(a.estimatedEVGain ?? 0))[0] ?? null;
}

export function buildTournamentFeedbackPayloadSummary({ candidates = [], feedbackDraft = null } = {}) {
  const worst = worstLeakCandidate(candidates);
  const drafts = feedbackDraft?.drafts ?? generateCoachingFeedbackDraftSummary({ candidates }).drafts;
  const worstDraft = drafts.find((draft) => draft.playerCount === Number(worst?.playerCount ?? 0)) ?? drafts[0] ?? {};
  return {
    generatedAt: new Date().toISOString(),
    payloadType: "tournament-end-feedback-preview",
    worstLeakSpot: worst
      ? {
          variantId: worst.variantId,
          spot: worst.spot,
          bucket: worst.bucket,
          playerCount: Number(worst.playerCount ?? 0),
          lessonTag: worst.lessonTag,
          estimatedEVLoss: Number(worst.estimatedEVGain ?? 0),
          recommendedAction: worst.ironAction,
          baselineAction: worst.proAction,
        }
      : null,
    summary: {
      jp: worst
        ? `今回最も大きな期待値損失候補は、深いスタックの${worst.playerCount}人局面でチェックを選ぶ場面でした。`
        : "今回の tournament-end feedback 候補はありません。",
      en: worst
        ? `Your biggest EV leak candidate was a passive check in a deep-stack ${worst.playerCount}-player spot.`
        : "No tournament-end feedback candidate was identified.",
    },
    feedbackDraft: worstDraft,
    candidateCount: candidates.length,
    previewOnly: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function buildTournamentFeedbackPayload({
  candidatesPath = path.resolve("reports/ai-iron/step46-coaching-material-candidates.jsonl"),
  outputPath = DEFAULT_STEP47_TOURNAMENT_FEEDBACK_OUTPUT_PATH,
  candidates = null,
  feedbackDraft = null,
} = {}) {
  const report = buildTournamentFeedbackPayloadSummary({
    candidates: candidates ?? (await readJsonl(candidatesPath)),
    feedbackDraft,
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildTournamentFeedbackPayload();
  console.log(JSON.stringify(report, null, 2));
}
