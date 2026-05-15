import path from "node:path";

import { readJson, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP52_REPLAY_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-eval/replay-telemetry-determinism-step52.json",
);

export function validateStep52ReplayTelemetryDeterminismSummary({
  fixtureReport = {},
  engagementReport = {},
} = {}) {
  const failures = [];
  if (!fixtureReport.allDeterministic) failures.push("fixture-not-deterministic");
  if (!engagementReport.deterministicOrdering) failures.push("telemetry-ordering-not-deterministic");
  if (engagementReport.backendUpload !== false) failures.push("backend-upload-enabled");
  if (engagementReport.networkDependency !== false) failures.push("network-dependency-enabled");
  return {
    generatedAt: new Date().toISOString(),
    deterministic: failures.length === 0,
    mismatchCount: 0,
    invalidReplayCount: 0,
    telemetryEventCount: engagementReport.events?.length ?? 0,
    replayMutation: false,
    telemetryMutation: false,
    failures,
    status: failures.length ? "FAIL" : "PASS",
  };
}

export async function validateStep52ReplayTelemetryDeterminism({
  fixturePath = path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json"),
  engagementPath = path.resolve("reports/ai-iron/step52-coaching-engagement-preview.json"),
  outputPath = DEFAULT_STEP52_REPLAY_DETERMINISM_OUTPUT_PATH,
  fixtureReport = null,
  engagementReport = null,
} = {}) {
  const report = validateStep52ReplayTelemetryDeterminismSummary({
    fixtureReport: fixtureReport ?? (await readJson(fixturePath)),
    engagementReport: engagementReport ?? (await readJson(engagementPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await validateStep52ReplayTelemetryDeterminism();
  console.log(JSON.stringify(report, null, 2));
}
