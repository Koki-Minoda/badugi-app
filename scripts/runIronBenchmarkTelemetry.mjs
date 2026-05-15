import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const tempFile = path.join(os.tmpdir(), `run-iron-benchmark-telemetry-${process.pid}.mjs`);

fs.writeFileSync(
  tempFile,
  `
import path from "node:path";
import { pathToFileURL } from "node:url";

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (process.env.MGX_SUPPRESS_DECK_STATE_LOGS === "true" && args[0] === "[DECK][STATE]") return;
  originalConsoleLog(...args);
};

const { runIronBenchmarkTelemetry } = await import(
  pathToFileURL(${JSON.stringify(path.resolve("src/ai/iron/runIronBenchmarkTelemetry.js"))}).href
);

const forwardedArgs = JSON.parse(process.env.MGX_AI_IRON_TELEMETRY_ARGS ?? "[]");
const options = {};
for (const argument of forwardedArgs) {
  if (!String(argument).startsWith("--")) continue;
  const [rawKey, rawValue = "true"] = String(argument).slice(2).split("=");
  options[rawKey] = rawValue;
}

const telemetry = await runIronBenchmarkTelemetry({
  datasetPath:
    typeof options.dataset === "string" && options.dataset.trim().length
      ? path.resolve(String(options.dataset))
      : null,
  hands: Number(options.hands ?? 3000),
  seeds:
    typeof options.seeds === "string" && options.seeds.trim().length
      ? options.seeds.split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite)
      : [20260728, 20260729, 20260730],
  outputPath:
    typeof options.output === "string" && options.output.trim().length
      ? path.resolve(String(options.output))
      : path.resolve("reports/ai-iron/iron-step23-benchmark-telemetry.json"),
  determinismPath:
    typeof options["determinism-path"] === "string" && options["determinism-path"].trim().length
      ? path.resolve(String(options["determinism-path"]))
      : path.resolve("reports/ai-eval/replay-determinism-audit-iron-step17.json"),
  monitoringRunId:
    typeof options["monitoring-run-id"] === "string" && options["monitoring-run-id"].trim().length
      ? String(options["monitoring-run-id"]).trim()
      : typeof options["run-id"] === "string" && options["run-id"].trim().length
        ? String(options["run-id"]).trim()
      : "iron-step23",
  arenaOutputPath:
    typeof options["arena-output"] === "string" && options["arena-output"].trim().length
      ? path.resolve(String(options["arena-output"]))
      : null,
  stabilityOutputPath:
    typeof options["stability-output"] === "string" && options["stability-output"].trim().length
      ? path.resolve(String(options["stability-output"]))
      : null,
  dryRunGateOutputPath:
    typeof options["dryrun-gate-output"] === "string" && options["dryrun-gate-output"].trim().length
      ? path.resolve(String(options["dryrun-gate-output"]))
      : null,
  driftOutputPath:
    typeof options["drift-output"] === "string" && options["drift-output"].trim().length
      ? path.resolve(String(options["drift-output"]))
      : null,
  persistHistory: String(options["persist-history"] ?? "false") === "true",
});

console.log(JSON.stringify(telemetry, null, 2));
`,
  "utf8",
);

const result = spawnSync(
  "npx",
  ["vite-node", tempFile],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      MGX_AI_IRON_TELEMETRY_ARGS: JSON.stringify(forwardedArgs),
    },
  },
);

fs.rmSync(tempFile, { force: true });
process.exit(result.status ?? 1);
