#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const label = process.env.TOURNAMENT_QM_REPORT_LABEL ?? "production-tournament-qm";
const reportDir = path.resolve("reports/tournament-qm");
const resultsPath = path.join(reportDir, `${label}-results.json`);
const gatePath = path.join(reportDir, `${label}-gate.json`);
const manifestPath = path.join(reportDir, `${label}-manifest.json`);
fs.mkdirSync(reportDir, { recursive: true });

const result = spawnSync(
  "npx",
  [
    "playwright",
    "test",
    "tests/e2e/tournament-stage-blind-transition.spec.ts",
    "--project=tournament-pr-chromium",
    "--grep=production QM",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, TOURNAMENT_QM_REPORT_LABEL: label },
  },
);

const payload = fs.existsSync(resultsPath)
  ? JSON.parse(fs.readFileSync(resultsPath, "utf8"))
  : null;
const stages = Array.isArray(payload?.stages) ? payload.stages : [];
const requiredStages = ["store", "local"];
const issues = [];
for (const stageId of requiredStages) {
  const stage = stages.find((entry) => entry.stageId === stageId);
  if (!stage) {
    issues.push(`${stageId}-missing`);
    continue;
  }
  if (stage.status !== "PASS") issues.push(`${stageId}-failed`);
  if (Number(stage.realHands) < 7 || stage.replayHandsVerified !== stage.realHands) {
    issues.push(`${stageId}-history-replay-incomplete`);
  }
  if (Number(stage.heroButtonClicks) < 1) issues.push(`${stageId}-hero-ui-action-missing`);
  if (Number(stage.blindLevel) < 2) issues.push(`${stageId}-blind-transition-missing`);
  if (Number(stage.finalTablePlayers) > 6) issues.push(`${stageId}-final-table-missing`);
  if (stage.reentryPolicy?.allowed !== false || Number(stage.reentryPolicy?.maxEntries) !== 1) {
    issues.push(`${stageId}-reentry-policy-invalid`);
  }
  if (stage.reviewDepth !== "hand-history" || !stage.returnedToResults) {
    issues.push(`${stageId}-review-flow-incomplete`);
  }
}
const gate = {
  generatedAt: new Date().toISOString(),
  sourceUrl: process.env.E2E_APP_URL ?? "local",
  status: result.status === 0 && payload?.status === "PASS" && issues.length === 0 ? "PASS" : "FAIL",
  playwrightExitCode: result.status ?? 1,
  requiredStages,
  issues,
  resultsPath,
};
fs.writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
const files = [resultsPath, gatePath].filter((filePath) => fs.existsSync(filePath));
const manifest = {
  generatedAt: new Date().toISOString(),
  label,
  status: gate.status,
  files: files.map((filePath) => ({
    path: filePath,
    bytes: fs.statSync(filePath).size,
    sha256: createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
  })),
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: gate.status, issues, resultsPath, gatePath, manifestPath }, null, 2));
process.exit(gate.status === "PASS" ? 0 : 1);
