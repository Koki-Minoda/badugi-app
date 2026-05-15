import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP48_LOCALE_PREVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step48-locale-preview.json",
);

function localeStatus(text = "", { maxLength = 180 } = {}) {
  const length = [...String(text)].length;
  return {
    length,
    readable: length > 0,
    overflowSafe: length <= maxLength,
    mobileTruncationSafe: length <= maxLength,
    status: length > 0 && length <= maxLength ? "PASS" : "WARN",
  };
}

export function renderCoachingLocalePreviewSummary({ viewModel = {} } = {}) {
  const rows = (viewModel.lessons ?? []).flatMap((lesson) => [
    {
      lessonId: lesson.lessonId,
      locale: "jp",
      text: lesson.jp,
      ...localeStatus(lesson.jp, { maxLength: 110 }),
    },
    {
      lessonId: lesson.lessonId,
      locale: "en",
      text: lesson.en,
      ...localeStatus(lesson.en, { maxLength: 130 }),
    },
  ]);
  return {
    generatedAt: new Date().toISOString(),
    source: "step48-coaching-viewmodel",
    rows,
    locales: {
      jp: rows.every((row) => row.locale !== "jp" || row.status === "PASS") ? "PASS" : "WARN",
      en: rows.every((row) => row.locale !== "en" || row.status === "PASS") ? "PASS" : "WARN",
    },
    textOverflow: rows.some((row) => row.overflowSafe !== true),
    mobileTruncationSafe: rows.every((row) => row.mobileTruncationSafe),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function renderCoachingLocalePreview({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  outputPath = DEFAULT_STEP48_LOCALE_PREVIEW_OUTPUT_PATH,
  viewModel = null,
} = {}) {
  const report = renderCoachingLocalePreviewSummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await renderCoachingLocalePreview();
  console.log(JSON.stringify(report, null, 2));
}
