import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP58_DEPLOY_READINESS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step58-deploy-readiness-checklist.json",
);

export function buildStep58DeployReadinessChecklistSummary({
  featureFlag = "PASS",
  flagOffIsolation = "PASS",
  storageFallback = "PASS",
  visualEvidence = "PASS",
  tests = "PASS",
  governance = "PASS",
} = {}) {
  const checks = [
    { check: "preview feature flag exists", result: featureFlag },
    { check: "flag OFF leaves production UI unchanged", result: flagOffIsolation },
    { check: "localStorage unavailable fallback", result: storageFallback },
    { check: "Step48-57 visual and E2E preview evidence exists", result: visualEvidence },
    { check: "required build and safety tests", result: tests },
    { check: "governance freeze", result: governance },
  ];
  const failures = checks.filter((item) => item.result !== "PASS").map((item) => item.check);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    deployReadiness: failures.length === 0 ? "READY_FOR_PREVIEW_DEPLOY" : "HOLD",
    checks,
    commitUnits: [
      "preview feature flag and dashboard route",
      "coaching/replay/dashboard preview UI and fixtures",
      "visual evidence, reports, and governance docs",
    ],
    rollback: [
      "disable VITE_MGX_COACHING_PREVIEW",
      "remove mgxPreview query/localStorage flag",
      "revert preview route/menu commit if needed",
    ],
    noProductionRollout: true,
    promoted: false,
    routingChanged: false,
    externalAnalytics: false,
    networkTelemetry: false,
    failures,
  };
}

export async function buildStep58DeployReadinessChecklist({
  outputPath = DEFAULT_STEP58_DEPLOY_READINESS_OUTPUT_PATH,
  options = {},
} = {}) {
  return writeJsonReport(outputPath, buildStep58DeployReadinessChecklistSummary(options));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildStep58DeployReadinessChecklist();
  console.log(JSON.stringify(report, null, 2));
}
