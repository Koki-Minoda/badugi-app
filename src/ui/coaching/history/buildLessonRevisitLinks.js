import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP54_REVISIT_LINKS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-lesson-revisit-links.json",
);

export function buildLessonRevisitLinksSummary({ entries = [] } = {}) {
  const links = entries
    .map((entry) => ({
      lessonId: entry.lessonId,
      replayRef: entry.replayRef,
      href: entry.replayUrl,
      deterministic: entry.replayDeterministic === true,
      replayRefValid: Boolean(entry.replayRef && entry.replayUrl),
      fallback: entry.replayRef && entry.replayUrl ? null : { status: "replay-unavailable", safe: true, crash: false },
    }))
    .sort((a, b) => String(a.lessonId).localeCompare(String(b.lessonId)));
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    linkCount: links.length,
    validCount: links.filter((link) => link.replayRefValid && link.deterministic).length,
    links,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildLessonRevisitLinks({
  historyPath = path.resolve("reports/ai-iron/step54-coaching-history-store.json"),
  outputPath = DEFAULT_STEP54_REVISIT_LINKS_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildLessonRevisitLinksSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildLessonRevisitLinks();
  console.log(JSON.stringify(report, null, 2));
}
