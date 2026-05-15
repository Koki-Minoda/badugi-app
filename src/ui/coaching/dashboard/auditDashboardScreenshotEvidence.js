import fs from "node:fs";
import path from "node:path";

import { writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP57_SCREENSHOT_EVIDENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-dashboard-screenshot-evidence.json",
);

export const STEP57_SCREENSHOT_PATHS = {
  global: "reports/screenshots/step57-learning-dashboard-global.png",
  S02: "reports/screenshots/step57-learning-dashboard-s02.png",
  D02: "reports/screenshots/step57-learning-dashboard-d02.png",
  mobilePortrait: "reports/screenshots/step57-learning-dashboard-mobile-portrait.png",
  mobileLandscape: "reports/screenshots/step57-learning-dashboard-mobile-landscape.png",
};

function fileEvidence(filePath) {
  const absolutePath = path.resolve(filePath);
  const exists = fs.existsSync(absolutePath);
  const bytes = exists ? fs.statSync(absolutePath).size : 0;
  return {
    path: filePath,
    absolutePath,
    exists,
    bytes,
    nonEmpty: bytes > 0,
  };
}

export function auditDashboardScreenshotEvidenceSummary({ screenshotPaths = STEP57_SCREENSHOT_PATHS } = {}) {
  const screenshots = Object.fromEntries(
    Object.entries(screenshotPaths).map(([view, filePath]) => [view, fileEvidence(filePath)]),
  );
  const failures = Object.entries(screenshots)
    .filter(([, evidence]) => !evidence.exists || !evidence.nonEmpty)
    .map(([view]) => view);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    screenshots,
    requiredViews: Object.keys(screenshotPaths),
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditDashboardScreenshotEvidence({
  outputPath = DEFAULT_STEP57_SCREENSHOT_EVIDENCE_OUTPUT_PATH,
  screenshotPaths = STEP57_SCREENSHOT_PATHS,
} = {}) {
  return writeJsonReport(outputPath, auditDashboardScreenshotEvidenceSummary({ screenshotPaths }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditDashboardScreenshotEvidence();
  console.log(JSON.stringify(report, null, 2));
}
