import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_REPLAY_ANNOTATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-replay-annotation-viewmodel.json",
);

function byLessonId(items = []) {
  return new Map(items.map((item) => [item.lessonId ?? item.candidateId, item]));
}

export function buildReplayCoachingAnnotationSummary({
  viewModel = {},
  focusPreview = {},
  replayLinks = {},
} = {}) {
  const lessons = byLessonId(viewModel.lessons ?? []);
  const linkMap = byLessonId(replayLinks.links ?? []);
  const annotations = (focusPreview.focusStates ?? [])
    .map((focusState) => {
      const lesson = lessons.get(focusState.lessonId);
      if (!lesson || focusState.status !== "ready") return null;
      const link = linkMap.get(focusState.lessonId) ?? {};
      return {
        lessonId: lesson.lessonId,
        variantId: lesson.variantId,
        actionIndex: focusState.actionIndex,
        severity: lesson.severity ?? "medium",
        lessonTag: lesson.lessonTag,
        evDelta: roundNumber(lesson.estimatedEVGain, 4),
        focusMode: focusState.focusMode,
        jp: lesson.jp,
        en: lesson.en,
        highlightAction: lesson.recommendedAction,
        baselineAction: lesson.baselineAction,
        replayRef: lesson.replayRef ?? link.replayRef ?? null,
        replayDeterministic: lesson.replayDeterministic === true && link.deterministic !== false,
        markerType: "coaching",
      };
    })
    .filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    source: "step48-viewmodel-plus-step49-focus",
    annotationCount: annotations.length,
    annotations,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildReplayCoachingAnnotation({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  focusPreviewPath = path.resolve("reports/ai-iron/step49-replay-focus-preview.json"),
  replayLinksPath = path.resolve("reports/ai-iron/step48-replay-links.json"),
  outputPath = DEFAULT_STEP50_REPLAY_ANNOTATION_OUTPUT_PATH,
  viewModel = null,
  focusPreview = null,
  replayLinks = null,
} = {}) {
  const report = buildReplayCoachingAnnotationSummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
    focusPreview: focusPreview ?? (await readJson(focusPreviewPath)),
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayCoachingAnnotation();
  console.log(JSON.stringify(report, null, 2));
}

