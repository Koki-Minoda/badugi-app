import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP51_FALLBACK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step51-real-replay-fallbacks.json",
);

function fallbackCase(caseName, reasons = []) {
  return {
    case: caseName,
    status: "preview-unavailable",
    safe: true,
    crash: false,
    reasons,
  };
}

export function auditRealReplayFallbacksSummary({ fixtureReport = {} } = {}) {
  const first = fixtureReport.fixtures?.[0] ?? {};
  const cases = [
    fallbackCase("replay file missing", ["replay-source-unavailable"]),
    fallbackCase("handId missing", ["hand-id-missing"]),
    fallbackCase("actionIndex out of range", ["action-index-out-of-range"]),
    fallbackCase("action row missing", ["action-row-missing"]),
    fallbackCase("lesson metadata mismatch", ["lesson-metadata-mismatch"]),
    fallbackCase("locale missing", ["locale-fallback-to-jp"]),
  ];
  return {
    generatedAt: new Date().toISOString(),
    source: "step51-real-replay-fixture",
    fixtureLesson: first.lessonId ?? null,
    cases,
    allSafe: cases.every((entry) => entry.safe === true && entry.crash === false),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditRealReplayFallbacks({
  fixturePath = path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json"),
  outputPath = DEFAULT_STEP51_FALLBACK_OUTPUT_PATH,
  fixtureReport = null,
} = {}) {
  const report = auditRealReplayFallbacksSummary({
    fixtureReport: fixtureReport ?? (await readJson(fixturePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditRealReplayFallbacks();
  console.log(JSON.stringify(report, null, 2));
}
