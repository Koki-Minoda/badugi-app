import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP51_REAL_ANNOTATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step51-real-replay-annotation-viewmodel.json",
);

function byLessonId(items = []) {
  return new Map(items.map((item) => [item.lessonId, item]));
}

export function buildRealReplayAnnotationViewModelSummary({
  fixtureReport = {},
  alignmentReport = {},
} = {}) {
  const alignmentByLesson = byLessonId(alignmentReport.alignments ?? []);
  const annotations = (fixtureReport.fixtures ?? []).map((fixture) => {
    const alignment = alignmentByLesson.get(fixture.lessonId) ?? {};
    return {
      lessonId: fixture.lessonId,
      variantId: fixture.variantId,
      handId: fixture.handId,
      actionIndex: fixture.actionIndex,
      actualAction: alignment.actualAction ?? fixture.actionAtIndex?.action ?? null,
      recommendedAction: fixture.coaching?.recommendedAction ?? null,
      baselineAction: fixture.coaching?.baselineAction ?? null,
      evDelta: roundNumber(fixture.coaching?.evDelta, 4),
      severity: fixture.coaching?.severity ?? "medium",
      lessonTag: fixture.coaching?.lessonTag ?? "missed-value",
      playerCount: fixture.playerCount,
      actorSeat: fixture.actorSeat,
      jp: fixture.coaching?.jp ?? "",
      en: fixture.coaching?.en ?? "",
      deterministic: fixture.coaching?.replayDeterministic === true,
      replayRef: fixture.realReplayRef,
      alignmentStatus: alignment.status ?? "FAIL",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "real-replay-fixture-plus-alignment",
    annotationCount: annotations.length,
    annotations,
    status:
      annotations.length > 0 &&
      annotations.every((annotation) => annotation.deterministic && annotation.alignmentStatus === "PASS")
        ? "PASS"
        : "FAIL",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildRealReplayAnnotationViewModel({
  fixturePath = path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json"),
  alignmentPath = path.resolve("reports/ai-iron/step51-replay-action-alignment.json"),
  outputPath = DEFAULT_STEP51_REAL_ANNOTATION_OUTPUT_PATH,
  fixtureReport = null,
  alignmentReport = null,
} = {}) {
  const report = buildRealReplayAnnotationViewModelSummary({
    fixtureReport: fixtureReport ?? (await readJson(fixturePath)),
    alignmentReport: alignmentReport ?? (await readJson(alignmentPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildRealReplayAnnotationViewModel();
  console.log(JSON.stringify(report, null, 2));
}
