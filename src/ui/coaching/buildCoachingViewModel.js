import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_COACHING_VIEWMODEL_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-coaching-viewmodel.json",
);

function feedbackByCandidate(feedbackDraft = {}) {
  return new Map((feedbackDraft.drafts ?? []).map((draft) => [draft.candidateId, draft]));
}

function linkByCandidate(replayLinks = {}) {
  return new Map((replayLinks.links ?? []).map((link) => [link.candidateId, link]));
}

export function buildCoachingViewModelSummary({
  handoff = {},
  tournamentPayload = {},
  replayLinks = {},
  feedbackDraft = {},
} = {}) {
  const feedback = feedbackByCandidate(feedbackDraft);
  const links = linkByCandidate(replayLinks);
  const worstId = tournamentPayload.worstLeakSpot?.playerCount
    ? `S02_DEEP_RAISECHECK_PC${tournamentPayload.worstLeakSpot.playerCount}`
    : null;
  const lessons = (handoff.candidates ?? []).map((candidate) => {
    const draft = feedback.get(candidate.candidateId) ?? {};
    const link = links.get(candidate.candidateId) ?? {};
    return {
      lessonId: candidate.candidateId,
      variantId: candidate.variantId,
      spot: candidate.spot,
      bucket: candidate.bucket,
      playerCount: Number(candidate.playerCount ?? 0),
      severity: candidate.severity ?? "medium",
      lessonTag: candidate.lessonTag,
      estimatedEVGain: roundNumber(candidate.estimatedEVGain, 4),
      recommendedAction: candidate.recommendedAction,
      baselineAction: candidate.baselineAction,
      jp: draft.jp ?? "",
      en: draft.en ?? "",
      tone: draft.tone ?? "coach-light",
      replayRef: link.replayRef ?? null,
      replayUrl: link.viewerRoutePreview ?? null,
      replayDeterministic: link.replayDeterministic === true,
      exactHits: Number(candidate.exactHits ?? 0),
      exactOpportunities: Number(candidate.exactOpportunities ?? 0),
      primaryTournamentLeak: candidate.candidateId === worstId,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: "step47-preview-artifacts",
    previewOnly: true,
    lessonCount: lessons.length,
    lessons,
    tournamentSummary: tournamentPayload.summary ?? null,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function buildCoachingViewModel({
  handoffPath = path.resolve("reports/ai-iron/step47-coaching-handoff-package.json"),
  tournamentPayloadPath = path.resolve("reports/ai-iron/step47-tournament-feedback-payload.json"),
  replayLinksPath = path.resolve("reports/ai-iron/step47-replay-deeplink-metadata.json"),
  feedbackDraftPath = path.resolve("reports/ai-iron/step47-coaching-feedback-draft.json"),
  outputPath = DEFAULT_STEP48_COACHING_VIEWMODEL_OUTPUT_PATH,
  handoff = null,
  tournamentPayload = null,
  replayLinks = null,
  feedbackDraft = null,
} = {}) {
  const report = buildCoachingViewModelSummary({
    handoff: handoff ?? (await readJson(handoffPath)),
    tournamentPayload: tournamentPayload ?? (await readJson(tournamentPayloadPath)),
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
    feedbackDraft: feedbackDraft ?? (await readJson(feedbackDraftPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingViewModel();
  console.log(JSON.stringify(report, null, 2));
}
