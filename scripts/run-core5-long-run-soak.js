#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
const timeoutMs = args.timeoutMs ?? args["timeout-ms"] ?? (fast ? "1800000" : "7200000");

const env = {
  ...process.env,
  BROWSER_GAMEPLAY_REPORT_LABEL: label,
  BROWSER_GAMEPLAY_HANDS: hands,
  BROWSER_GAMEPLAY_VARIANTS: variants,
  BROWSER_GAMEPLAY_MODES: modes,
  BROWSER_GAMEPLAY_VIEWPORTS: viewports,
  BROWSER_TRACE_MODE: args.traceMode ?? args["trace-mode"] ?? "light",
  BROWSER_RUNTIME_TELEMETRY: args.runtimeTelemetry ?? args["runtime-telemetry"] ?? "1",
  BROWSER_GAMEPLAY_TIMEOUT_MS: timeoutMs,
};

const startedAt = new Date().toISOString();
const result = spawnSync(
  "npx",
  ["playwright", "test", "tests/e2e/browser-gameplay-invariant-harness.spec.ts", "--project=badugi-flow"],
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
const status =
  result.status !== 0 || blockingFailures.length > 0
    ? "FAIL"
    : monitorFailures.length > 0
      ? "PASS_WITH_MONITOR"
      : "PASS";
const gate = {
  generatedAt: new Date().toISOString(),
  startedAt,
  status,
  fast,
  config: { hands, variants, modes, viewports, timeoutMs },
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
};
writeJson(`reports/browser-gameplay/${label}-gate.json`, gate);
console.log(JSON.stringify({ status: gate.status, summaryPath, failurePath, gatePath: `reports/browser-gameplay/${label}-gate.json` }, null, 2));
process.exit(gate.status === "FAIL" ? 1 : 0);
