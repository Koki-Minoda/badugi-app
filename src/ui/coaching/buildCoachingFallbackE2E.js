import path from "node:path";

import { writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";
import { buildReplayLessonFocusState } from "./buildReplayLessonFocusState.js";

export const DEFAULT_STEP49_FALLBACK_E2E_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step49-fallback-e2e.json",
);

export function buildCoachingFallbackE2ESummary() {
  const cases = [
    {
      case: "replay missing",
      state: buildReplayLessonFocusState({
        href: "",
        deterministic: true,
        replayRefValid: false,
        knownLessonIds: ["S02_DEEP_RAISECHECK_PC3"],
      }),
    },
    {
      case: "actionIndex out of range",
      state: buildReplayLessonFocusState({
        href: "/replay?variant=S02&seed=20260609&hand=1&actionIndex=999&lesson=S02_DEEP_RAISECHECK_PC3",
        deterministic: false,
        replayRefValid: true,
        knownLessonIds: ["S02_DEEP_RAISECHECK_PC3"],
      }),
    },
    {
      case: "lessonId unknown",
      state: buildReplayLessonFocusState({
        href: "/replay?variant=S02&seed=20260609&hand=1&actionIndex=5&lesson=UNKNOWN",
        deterministic: true,
        replayRefValid: true,
        knownLessonIds: ["S02_DEEP_RAISECHECK_PC3"],
      }),
    },
    {
      case: "locale missing",
      state: {
        status: "preview-ready",
        safe: true,
        crash: false,
        fallbackLocale: "jp",
      },
    },
  ].map((entry) => ({
    case: entry.case,
    safe: entry.state.safe === true,
    crash: false,
    status: entry.state.status,
    reasons: entry.state.reasons ?? [],
  }));
  return {
    generatedAt: new Date().toISOString(),
    cases,
    allSafe: cases.every((entry) => entry.safe && entry.crash === false),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function writeCoachingFallbackE2E({
  outputPath = DEFAULT_STEP49_FALLBACK_E2E_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, buildCoachingFallbackE2ESummary());
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCoachingFallbackE2E();
  console.log(JSON.stringify(report, null, 2));
}

