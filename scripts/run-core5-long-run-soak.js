#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg === "--fast") out.fast = true;
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

const args = parseArgs(process.argv.slice(2));
const fast = Boolean(args.fast);
const label = args.label ?? (fast ? "core5-long-run-soak-fast" : "core5-long-run-soak");
const hands = args.hands ?? (fast ? "5" : "200");
const variants = args.variants ?? "badugi,D01,D02,S01,S02";
const modes = args.modes ?? "cash,tournament";
const viewports = args.viewports ?? (fast ? "desktop,portrait" : "desktop,portrait,landscape");
const seeds = args.seeds ?? (fast ? "101" : "101,127");
const project = args.project ?? "badugi-flow";
const timeoutMs = args.timeoutMs ?? args["timeout-ms"] ?? (fast ? "1800000" : "7200000");

const env = {
  ...process.env,
  BROWSER_GAMEPLAY_REPORT_LABEL: label,
  BROWSER_GAMEPLAY_HANDS: hands,
  BROWSER_GAMEPLAY_VARIANTS: variants,
  BROWSER_GAMEPLAY_MODES: modes,
  BROWSER_GAMEPLAY_VIEWPORTS: viewports,
  BROWSER_GAMEPLAY_SEEDS: seeds,
  BROWSER_TRACE_MODE: args.traceMode ?? args["trace-mode"] ?? "light",
  BROWSER_RUNTIME_TELEMETRY: args.runtimeTelemetry ?? args["runtime-telemetry"] ?? "1",
  BROWSER_GAMEPLAY_TIMEOUT_MS: timeoutMs,
};

const startedAt = new Date().toISOString();
const result = spawnSync(
  "npx",
  ["playwright", "test", "tests/e2e/browser-gameplay-invariant-harness.spec.ts", `--project=${project}`],
  { stdio: "inherit", env },
);
const summaryPath = `reports/browser-gameplay/${label}-summary.json`;
const failurePath = `reports/browser-gameplay/${label}-failures.json`;
const summary = readJson(summaryPath);
const failurePayload = readJson(failurePath);
const failures = Array.isArray(failurePayload)
  ? failurePayload
  : Array.isArray(failurePayload?.failures)
    ? failurePayload.failures
    : [];
const monitorTypes = new Set(["PHASE", "POT"]);
const monitorFailures = failures.filter((failure) => {
  const severity = String(failure?.severity ?? "").toUpperCase();
  const type = String(failure?.type ?? "").toUpperCase();
  return ["P1", "P2"].includes(severity) && monitorTypes.has(type);
});
const blockingFailures = failures.filter((failure) => {
  const severity = String(failure?.severity ?? "").toUpperCase();
  const type = String(failure?.type ?? "").toUpperCase();
  if (severity === "P0") return true;
  if (severity !== "P1") return false;
  return !monitorTypes.has(type);
});
const expectedRows =
  variants.split(",").filter(Boolean).length *
  modes.split(",").filter(Boolean).length *
  viewports.split(",").filter(Boolean).length *
  seeds.split(",").filter(Boolean).length;
const expectedCompletedHands = expectedRows * Number(hands);
const completedHands = Number(summary?.handsCompleted ?? 0);
const incompleteRows = (summary?.rows ?? []).filter(
  (row) => Number(row?.handsCompleted ?? 0) < Number(hands),
);
const artifactIssues = [];
if (!summary) artifactIssues.push("summary-missing");
if (!failurePayload) artifactIssues.push("failure-report-missing");
if (Number(summary?.rows?.length ?? 0) !== expectedRows) artifactIssues.push("scenario-count-mismatch");
if (completedHands < expectedCompletedHands) artifactIssues.push("completed-hands-below-target");
if (incompleteRows.length > 0) artifactIssues.push("incomplete-scenario-rows");
const status =
  result.status !== 0 || blockingFailures.length > 0 || artifactIssues.length > 0
    ? "FAIL"
    : monitorFailures.length > 0
      ? "PASS_WITH_MONITOR"
      : "PASS";
const gate = {
  generatedAt: new Date().toISOString(),
  startedAt,
  status,
  fast,
  config: { hands, variants, modes, viewports, seeds, project, timeoutMs },
  playwrightExitCode: result.status ?? 1,
  summaryPath,
  failurePath,
  summary,
  monitorFailureCount: monitorFailures.length,
  monitorFailuresByType: monitorFailures.reduce((acc, failure) => {
    const type = String(failure?.type ?? "UNKNOWN").toUpperCase();
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {}),
  blockingFailureCount: blockingFailures.length,
  blockingFailures,
  expectedRows,
  expectedCompletedHands,
  completedHands,
  artifactIssues,
};
const gatePath = `reports/browser-gameplay/${label}-gate.json`;
writeJson(gatePath, gate);
const artifactPaths = fs
  .readdirSync("reports/browser-gameplay", { recursive: true })
  .map((entry) => path.join("reports/browser-gameplay", String(entry)))
  .filter((entry) => fs.statSync(entry).isFile())
  .filter((entry) => path.basename(entry).includes(label));
const manifest = {
  generatedAt: new Date().toISOString(),
  label,
  status: gate.status,
  config: gate.config,
  expectedCompletedHands,
  completedHands,
  files: artifactPaths.map((filePath) => ({
    path: filePath,
    bytes: fs.statSync(filePath).size,
    sha256: createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
  })),
};
const manifestPath = `reports/browser-gameplay/${label}-manifest.json`;
writeJson(manifestPath, manifest);
console.log(JSON.stringify({ status: gate.status, summaryPath, failurePath, gatePath, manifestPath }, null, 2));
process.exit(gate.status === "FAIL" ? 1 : 0);
