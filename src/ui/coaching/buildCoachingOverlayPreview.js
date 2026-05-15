import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_OVERLAY_PREVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-overlay-preview.json",
);

export function buildCoachingOverlayPreviewSummary({ viewModel = {} } = {}) {
  const cards = (viewModel.lessons ?? []).map((lesson) => ({
    lessonId: lesson.lessonId,
    severityBadge: lesson.severity,
    evGainLabel: `EV +${lesson.estimatedEVGain}`,
    replayButton: {
      visible: true,
      disabledPreview: !lesson.replayDeterministic,
      href: lesson.replayUrl,
    },
    theme: "mgx-gold-black",
    compact: true,
    mobileSafe: true,
  }));
  return {
    generatedAt: new Date().toISOString(),
    component: "CoachingPreviewCard",
    overlay: "TournamentResultOverlay",
    previewOnly: true,
    cardCount: cards.length,
    cards,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingOverlayPreview({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  outputPath = DEFAULT_STEP48_OVERLAY_PREVIEW_OUTPUT_PATH,
  viewModel = null,
} = {}) {
  const report = buildCoachingOverlayPreviewSummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingOverlayPreview();
  console.log(JSON.stringify(report, null, 2));
}
