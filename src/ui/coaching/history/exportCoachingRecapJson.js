import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP55_LOCAL_EXPORT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-local-recap-export-preview.json",
);

export function exportCoachingRecapJsonSummary({
  recap = {},
  repeatedLeaks = {},
  revisitLinks = [],
  telemetry = {},
} = {}) {
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    previewOnly: true,
    piiIncluded: false,
    backendUpload: false,
    networkTelemetry: false,
    globalSummary: recap.global ?? {},
    perVariantSummary: recap.byVariant ?? {},
    repeatedLeaks: repeatedLeaks.byVariant ?? {},
    replayRevisitLinks: revisitLinks.length ? revisitLinks : recap.replayRevisitLinks ?? [],
    telemetryAggregate: telemetry.global ? telemetry : recap.telemetry ?? {},
    governance: {
      promoted: false,
      routingChanged: false,
      priorityFrozen: true,
      d01Excluded: true,
      externalAnalytics: false,
      networkTelemetry: false,
      hiddenTelemetry: false,
    },
  };
}

export async function exportCoachingRecapJson({
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  repeatedLeaksPath = path.resolve("reports/ai-iron/step55-variant-repeated-leaks.json"),
  telemetryPath = path.resolve("reports/ai-iron/step55-variant-aware-telemetry.json"),
  outputPath = DEFAULT_STEP55_LOCAL_EXPORT_OUTPUT_PATH,
  recap = null,
  repeatedLeaks = null,
  telemetry = null,
} = {}) {
  const report = exportCoachingRecapJsonSummary({
    recap: recap ?? (await readJson(recapPath)),
    repeatedLeaks: repeatedLeaks ?? (await readJson(repeatedLeaksPath)),
    telemetry: telemetry ?? (await readJson(telemetryPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await exportCoachingRecapJson();
  console.log(JSON.stringify(report, null, 2));
}
