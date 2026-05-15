import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { parseReplayLessonLink } from "./parseReplayLessonLink.js";

export const DEFAULT_STEP49_REPLAY_FOCUS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step49-replay-focus-preview.json",
);

export function buildReplayLessonFocusState({
  href = "",
  deterministic = true,
  replayRefValid = true,
  knownLessonIds = [],
} = {}) {
  const parsed = parseReplayLessonLink(href);
  const lessonKnown = !knownLessonIds.length || knownLessonIds.includes(parsed.lessonId);
  const reasons = [];
  if (!parsed.valid) reasons.push(...parsed.errors);
  if (!deterministic) reasons.push("replay-not-deterministic");
  if (!replayRefValid) reasons.push("replay-ref-invalid");
  if (!lessonKnown) reasons.push("lesson-unknown");

  if (reasons.length) {
    return {
      status: "preview-unavailable",
      safe: true,
      focusMode: "fallback",
      replayRefValid: replayRefValid === true,
      actionIndex: parsed.actionIndex,
      lessonId: parsed.lessonId,
      reasons,
    };
  }

  return {
    status: "ready",
    safe: true,
    replayRefValid: true,
    actionIndex: parsed.actionIndex,
    lessonId: parsed.lessonId,
    focusMode: "coaching-lesson",
    target: {
      handId: parsed.handId,
      actionSeq: parsed.actionIndex,
      actionSeqStart: parsed.actionIndex,
      replayTarget: {
        handId: parsed.handId,
        actionSeqStart: parsed.actionIndex,
      },
    },
    parsed,
  };
}

export function buildReplayLessonFocusPreviewSummary({ replayLinks = {}, viewModel = {} } = {}) {
  const knownLessonIds = (viewModel.lessons ?? []).map((lesson) => lesson.lessonId);
  const focusStates = (replayLinks.links ?? []).map((link) => ({
    href: link.href,
    ...buildReplayLessonFocusState({
      href: link.href,
      deterministic: link.deterministic,
      replayRefValid: link.replayRefValid,
      knownLessonIds,
    }),
  }));
  return {
    generatedAt: new Date().toISOString(),
    source: "step48-replay-links",
    focusStates,
    readyCount: focusStates.filter((state) => state.status === "ready").length,
    fallbackCount: focusStates.filter((state) => state.status !== "ready").length,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function writeReplayLessonFocusPreview({
  replayLinksPath = path.resolve("reports/ai-iron/step48-replay-links.json"),
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  outputPath = DEFAULT_STEP49_REPLAY_FOCUS_OUTPUT_PATH,
  replayLinks = null,
  viewModel = null,
} = {}) {
  const report = buildReplayLessonFocusPreviewSummary({
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
    viewModel: viewModel ?? (await readJson(viewModelPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayLessonFocusPreview();
  console.log(JSON.stringify(report, null, 2));
}

