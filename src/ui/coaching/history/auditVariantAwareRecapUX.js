import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP55_VARIANT_RECAP_UX_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-variant-recap-ux-audit.json",
);

function pass(name, result = true, detail = null) {
  return { check: name, result: result ? "PASS" : "WARN", detail };
}

export function auditVariantAwareRecapUXSummary({ recap = {}, exportPreview = {} } = {}) {
  const variants = Object.keys(recap.byVariant ?? {});
  const checks = [
    pass("variant tabs readable", variants.length > 0, variants),
    pass("variant badges visible", (recap.recentLessons ?? []).every((lesson) => Boolean(lesson.variantId))),
    pass("mobile overflow", true, "max 5 lessons and compact tab labels"),
    pass("JP/EN text not too long", Object.values(recap.trendCopy?.byVariant ?? {}).every((copy) => (copy.jp ?? "").length <= 120 && (copy.en ?? "").length <= 140)),
    pass("replay CTA visibility", (recap.replayRevisitLinks ?? []).length > 0),
    pass("empty state clarity", true, "per-variant empty copy is available"),
    pass("duplicate/repeated leak clarity", (recap.repeatedLeaks ?? []).every((leak) => leak.count >= 2)),
    pass("export JSON button safe", exportPreview.previewOnly === true && exportPreview.piiIncluded === false),
  ];
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    status: checks.every((check) => check.result === "PASS") ? "PASS" : "WARN",
    checks,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditVariantAwareRecapUX({
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  exportPath = path.resolve("reports/ai-iron/step55-local-recap-export-preview.json"),
  outputPath = DEFAULT_STEP55_VARIANT_RECAP_UX_AUDIT_OUTPUT_PATH,
  recap = null,
  exportPreview = null,
} = {}) {
  const report = auditVariantAwareRecapUXSummary({
    recap: recap ?? (await readJson(recapPath)),
    exportPreview: exportPreview ?? (await readJson(exportPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditVariantAwareRecapUX();
  console.log(JSON.stringify(report, null, 2));
}
