import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";
import { readJsonl } from "./buildRLSignalPreview.js";

export const DEFAULT_STEP47_FEEDBACK_DRAFT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step47-coaching-feedback-draft.json",
);

function jpDraft(candidate = {}) {
  const playerText = Number(candidate.playerCount ?? 0) ? `${candidate.playerCount}人局面` : "この局面";
  return `この場面では、深いスタックの${playerText}でSDA5が強く、チェックで回すよりレイズして価値を取りに行く方が期待値を改善できる可能性があります。`;
}

function enDraft(candidate = {}) {
  const playerText = Number(candidate.playerCount ?? 0) ? `${candidate.playerCount}-player` : "this";
  return `In this deep-stack ${playerText} SDA5 spot, raising may capture more value than checking back.`;
}

export function generateCoachingFeedbackDraftSummary({ candidates = [] } = {}) {
  const drafts = candidates.map((candidate) => ({
    candidateId: `S02_DEEP_RAISECHECK_PC${candidate.playerCount ?? "UNKNOWN"}`,
    variantId: candidate.variantId ?? "S02",
    spot: candidate.spot ?? "deep RAISE-vs-CHECK",
    playerCount: Number(candidate.playerCount ?? 0),
    lessonTag: candidate.lessonTag ?? "missed-value",
    tone: "coach-light",
    certainty: "evidence-backed-not-solver-claim",
    jp: jpDraft(candidate),
    en: enDraft(candidate),
    constraints: {
      solverAssertion: false,
      gtoAssertion: false,
      hallucinatedCertainty: false,
    },
  }));
  return {
    generatedAt: new Date().toISOString(),
    source: "step46-coaching-material-candidates",
    draftCount: drafts.length,
    drafts,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function generateCoachingFeedbackDraft({
  candidatesPath = path.resolve("reports/ai-iron/step46-coaching-material-candidates.jsonl"),
  outputPath = DEFAULT_STEP47_FEEDBACK_DRAFT_OUTPUT_PATH,
  candidates = null,
} = {}) {
  const report = generateCoachingFeedbackDraftSummary({ candidates: candidates ?? (await readJsonl(candidatesPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await generateCoachingFeedbackDraft();
  console.log(JSON.stringify(report, null, 2));
}
