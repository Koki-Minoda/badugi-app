import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { buildReplayLessonFocusState } from "./buildReplayLessonFocusState.js";

export const DEFAULT_STEP49_E2E_FIXTURE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step49-coaching-e2e-fixture.json",
);

export function buildCoachingE2EFixtureSummary({ viewModel = {}, replayLinks = {} } = {}) {
  const primaryLesson =
    (viewModel.lessons ?? []).find((lesson) => lesson.primaryTournamentLeak) ??
    (viewModel.lessons ?? [])[0] ??
    null;
  const primaryLink =
    (replayLinks.links ?? []).find((link) => link.lessonId === primaryLesson?.lessonId) ??
    (replayLinks.links ?? [])[0] ??
    null;
  const focusState = primaryLink
    ? buildReplayLessonFocusState({
        href: primaryLink.href,
        deterministic: primaryLink.deterministic,
        replayRefValid: primaryLink.replayRefValid,
        knownLessonIds: (viewModel.lessons ?? []).map((lesson) => lesson.lessonId),
      })
    : null;

  return {
    generatedAt: new Date().toISOString(),
    source: "step48-preview-artifacts",
    previewOnly: true,
    tournamentResultMock: {
      title: "Tournament Results",
      placements: [
        { id: "hero", place: 2, name: "Hero", stack: 880, payout: 320 },
        { id: "cpu-1", place: 1, name: "CPU 1", stack: 1640, payout: 500 },
        { id: "cpu-2", place: 3, name: "CPU 2", stack: 0, payout: 180 },
      ],
    },
    coachingLesson: primaryLesson,
    coachingPreview: {
      lessons: viewModel.lessons ?? [],
    },
    replayDeeplink: primaryLink?.href ?? null,
    replayRef: primaryLesson?.replayRef ?? primaryLink?.replayRef ?? null,
    actionIndex: focusState?.actionIndex ?? null,
    locale: "jp",
    focusState,
    fallbackCase: {
      href: "/replay?variant=S02&seed=20260609&hand=1&actionIndex=999&lesson=UNKNOWN",
      expectedStatus: "preview-unavailable",
      safe: true,
    },
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingE2EFixture({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  replayLinksPath = path.resolve("reports/ai-iron/step48-replay-links.json"),
  outputPath = DEFAULT_STEP49_E2E_FIXTURE_OUTPUT_PATH,
  viewModel = null,
  replayLinks = null,
} = {}) {
  const report = buildCoachingE2EFixtureSummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingE2EFixture();
  console.log(JSON.stringify(report, null, 2));
}

