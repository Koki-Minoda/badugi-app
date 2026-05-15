import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_UX_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-coaching-ux-audit.json",
);

function pass(value) {
  return value ? "PASS" : "FAIL";
}

export function auditCoachingUXSummary({ viewModel = {}, replayLinks = {}, localePreview = {} } = {}) {
  const lessonIds = (viewModel.lessons ?? []).map((lesson) => lesson.lessonId);
  const duplicateLessons = lessonIds.filter((id, index) => lessonIds.indexOf(id) !== index);
  const checks = [
    {
      check: "severity visibility",
      result: pass((viewModel.lessons ?? []).every((lesson) => Boolean(lesson.severity))),
    },
    {
      check: "EV readability",
      result: pass((viewModel.lessons ?? []).every((lesson) => Number.isFinite(Number(lesson.estimatedEVGain)))),
    },
    {
      check: "mobile layout safety",
      result: localePreview.mobileTruncationSafe === false ? "WARN" : "PASS",
    },
    {
      check: "replay CTA visibility",
      result: pass((replayLinks.links ?? []).every((link) => Boolean(link.href))),
    },
    {
      check: "overflow",
      result: localePreview.textOverflow ? "WARN" : "PASS",
    },
    {
      check: "duplicate lessons",
      result: pass(duplicateLessons.length === 0),
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    checks,
    verdict: checks.some((check) => check.result === "FAIL") ? "FAIL" : checks.some((check) => check.result === "WARN") ? "WARN" : "PASS",
    duplicateLessons,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditCoachingUX({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  replayLinksPath = path.resolve("reports/ai-iron/step48-replay-links.json"),
  localePreviewPath = path.resolve("reports/ai-iron/step48-locale-preview.json"),
  outputPath = DEFAULT_STEP48_UX_AUDIT_OUTPUT_PATH,
  viewModel = null,
  replayLinks = null,
  localePreview = null,
} = {}) {
  const report = auditCoachingUXSummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
    replayLinks: replayLinks ?? (await readJson(replayLinksPath)),
    localePreview: localePreview ?? (await readJson(localePreviewPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCoachingUX();
  console.log(JSON.stringify(report, null, 2));
}
