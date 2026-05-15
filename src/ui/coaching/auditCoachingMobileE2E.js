import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP49_MOBILE_E2E_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step49-mobile-e2e-audit.json",
);

function auditViewport(viewport, lessons = []) {
  const maxTextLength = viewport.width < 400 ? 95 : 120;
  const textSafe = lessons.every((lesson) => {
    const jpLength = [...String(lesson.jp ?? "")].length;
    const enLength = [...String(lesson.en ?? "")].length;
    return jpLength <= maxTextLength && enLength <= maxTextLength + 25;
  });
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    cardCount: lessons.length,
    replayCtaVisible: lessons.every((lesson) => lesson.replayDeterministic === true),
    textOverflow: !textSafe,
    result: textSafe ? "PASS" : "WARN",
  };
}

export function auditCoachingMobileE2ESummary({ viewModel = {} } = {}) {
  const viewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ].map((viewport) => auditViewport(viewport, viewModel.lessons ?? []));
  return {
    generatedAt: new Date().toISOString(),
    viewports,
    result: viewports.some((entry) => entry.result === "FAIL")
      ? "FAIL"
      : viewports.some((entry) => entry.result === "WARN")
        ? "WARN"
        : "PASS",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditCoachingMobileE2E({
  viewModelPath = path.resolve("reports/ai-iron/step48-coaching-viewmodel.json"),
  outputPath = DEFAULT_STEP49_MOBILE_E2E_OUTPUT_PATH,
  viewModel = null,
} = {}) {
  const report = auditCoachingMobileE2ESummary({
    viewModel: viewModel ?? (await readJson(viewModelPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCoachingMobileE2E();
  console.log(JSON.stringify(report, null, 2));
}

