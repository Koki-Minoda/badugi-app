import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [, , scriptPath, ...args] = process.argv;

if (!scriptPath) {
  console.error("Usage: node scripts/runPythonTool.mjs <script.py> [...args]");
  process.exit(2);
}

const pythonCandidates = process.platform === "win32"
  ? [".venv-rl/Scripts/python.exe", ".venv/Scripts/python.exe"]
  : [".venv/bin/python"];
const python = pythonCandidates.find((candidate) => existsSync(candidate))
  ?? (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, [scriptPath, ...args], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
