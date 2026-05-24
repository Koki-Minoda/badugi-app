import fs from "node:fs";
import path from "node:path";

export const SOAK_REPORT_ROOT = "reports/soak";

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

export function sanitizeSoakId(value) {
  return String(value ?? "unknown")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function createSoakRunContext({ label = process.env.SOAK_RUN_LABEL, tier = process.env.SOAK_TIER ?? "fast" } = {}) {
  const runId = sanitizeSoakId(label || `${timestampSlug()}-${tier}`);
  const runDir = path.resolve(SOAK_REPORT_ROOT, runId);
  fs.mkdirSync(runDir, { recursive: true });
  return { runId, runDir };
}

export function scenarioReportDir(runContext, scenario) {
  const dir = path.join(runContext.runDir, sanitizeSoakId(scenario?.id));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

export function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(text ?? ""));
  return filePath;
}

export function writeTrace(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return filePath;
}

export function attachSoakPageRecorders(page) {
  const consoleRows = [];
  const networkRows = [];
  const pageErrors = [];

  page.on("console", (message) => {
    const text = message.text();
    const type = message.type();
    consoleRows.push({ timestamp: Date.now(), type, text });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ timestamp: Date.now(), message: error.message, stack: error.stack ?? null });
  });
  page.on("requestfailed", (request) => {
    networkRows.push({
      timestamp: Date.now(),
      type: "requestfailed",
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText ?? null,
    });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      networkRows.push({
        timestamp: Date.now(),
        type: "response",
        status,
        url: response.url(),
      });
    }
  });

  return {
    consoleRows,
    networkRows,
    pageErrors,
    fatalConsoleErrors() {
      return consoleRows.filter((row) => {
        if (row.type !== "error") return false;
        return !/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(row.text);
      });
    },
  };
}

export async function writeSoakFailureArtifacts({ page, runContext, scenario, error, traceRows, lastSnapshot, recorders, classification = null }) {
  const dir = scenarioReportDir(runContext, scenario);
  const screenshotPath = path.join(dir, "screenshot.png");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  writeJson(path.join(dir, "summary.json"), {
    generatedAt: new Date().toISOString(),
    status: "FAIL",
    classification,
    scenario,
    error: {
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
    },
    traceRows: traceRows.length,
    screenshotPath,
  });
  writeTrace(path.join(dir, "trace.jsonl"), traceRows);
  writeJson(path.join(dir, "trace.json"), traceRows);
  writeJson(path.join(dir, "last-gameplay-snapshot.json"), lastSnapshot ?? null);
  writeText(path.join(dir, "console.log"), (recorders?.consoleRows ?? []).map((row) => `[${row.type}] ${row.text}`).join("\n"));
  writeJson(path.join(dir, "network.log"), recorders?.networkRows ?? []);
  return dir;
}

export function writeSoakSummary(runContext, rows) {
  const status = rows.some((row) => row.status === "FAIL")
    ? "FAIL"
    : rows.some((row) => row.status === "WARN")
      ? "WARN"
      : "PASS";
  const summary = {
    generatedAt: new Date().toISOString(),
    runId: runContext.runId,
    status,
    scenarioCount: rows.length,
    scenariosPassed: rows.filter((row) => row.status === "PASS").length,
    scenariosWarned: rows.filter((row) => row.status === "WARN").length,
    scenariosFailed: rows.filter((row) => row.status === "FAIL").length,
    rows,
  };
  writeJson(path.join(runContext.runDir, "summary.json"), summary);
  writeJson(path.resolve(SOAK_REPORT_ROOT, "latest-summary.json"), summary);
  return summary;
}
