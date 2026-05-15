import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP50_LOCALE_ANNOTATION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step50-locale-annotation-preview.json",
);

function checkText(text = "", maxLength = 120) {
  const length = [...String(text)].length;
  return {
    length,
    readable: length > 0,
    overflow: length > maxLength,
    mobileTruncationSafe: length <= maxLength,
    lineBreakSafe: !String(text).includes("\n\n"),
    result: length > 0 && length <= maxLength ? "PASS" : "WARN",
  };
}

export function renderReplayCoachingLocalePreviewSummary({ annotations = {} } = {}) {
  const rows = (annotations.annotations ?? []).flatMap((annotation) => [
    {
      lessonId: annotation.lessonId,
      locale: "jp",
      text: annotation.jp,
      ...checkText(annotation.jp, 115),
    },
    {
      lessonId: annotation.lessonId,
      locale: "en",
      text: annotation.en,
      ...checkText(annotation.en, 135),
    },
  ]);
  return {
    generatedAt: new Date().toISOString(),
    rows,
    locales: {
      jp: rows.every((row) => row.locale !== "jp" || row.result === "PASS") ? "PASS" : "WARN",
      en: rows.every((row) => row.locale !== "en" || row.result === "PASS") ? "PASS" : "WARN",
    },
    textOverflow: rows.some((row) => row.overflow),
    mobileTruncationSafe: rows.every((row) => row.mobileTruncationSafe),
    result: rows.some((row) => row.result === "WARN") ? "WARN" : "PASS",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function renderReplayCoachingLocalePreview({
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP50_LOCALE_ANNOTATION_OUTPUT_PATH,
  annotations = null,
} = {}) {
  const report = renderReplayCoachingLocalePreviewSummary({
    annotations: annotations ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await renderReplayCoachingLocalePreview();
  console.log(JSON.stringify(report, null, 2));
}

