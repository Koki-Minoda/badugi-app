import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEVTOOLS_DIR = __dirname;
const TASK_FILE = path.join(DEVTOOLS_DIR, "auto_tasks.yaml");
const TEMPLATE_FILE = path.join(DEVTOOLS_DIR, "codex_prompt_template.txt");
const OUTPUT_DIR = path.join(DEVTOOLS_DIR, "output");
const LOG_DIR = path.join(DEVTOOLS_DIR, "logs");

function parseArgs(argv) {
  const [, , command = "run", ...rest] = argv;
  const options = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    switch (token) {
      case "--task":
        options.taskId = rest[++i];
        break;
      case "--response":
        options.responseFile = rest[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--reason":
        options.reason = rest[++i];
        break;
      default:
        // ignore unrecognised tokens for now
        break;
    }
  }
  return options;
}

export async function loadTasks(filePath = TASK_FILE) {
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
      throw new Error("Task file must contain a root { \"tasks\": [] } object.");
    }
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse tasks YAML/JSON: ${err.message}`);
  }
}

export function selectTask(tasks, targetId) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("No tasks available.");
  }
  if (targetId) {
    const task = tasks.find((item) => item.id === targetId);
    if (!task) throw new Error(`Task ${targetId} not found.`);
    return task;
  }
  const pending = tasks.find((item) => item.status === "pending");
  if (!pending) throw new Error("No pending tasks remain.");
  return pending;
}

export function buildPrompt(template, task, extra = {}) {
  if (!template) throw new Error("Prompt template missing.");
  const replacements = {
    TASK_ID: task.id ?? "",
    TASK_TITLE: task.title ?? "",
    TASK_STATUS: task.status ?? "",
    TASK_OWNER: task.owner ?? "",
    TASK_PATH: task.path ?? "",
    TASK_SUMMARY: task.summary ?? "",
    ...extra,
  };
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, token) => replacements[token] ?? "");
}

export function validateResponse(content) {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Codex response is empty.");
  }
  return content;
}

export function buildCommitMetadata(task) {
  const prName = `Codex AutoPR - ${task.id} ${task.title}`;
  return {
    branch: `codex/${task.id.toLowerCase()}`,
    commit: prName,
    prName,
  };
}

export function ensureUniquePrName(historySet, prName) {
  if (historySet.has(prName)) {
    throw new Error(`PR name already used: ${prName}`);
  }
  historySet.add(prName);
  return historySet;
}

async function saveTasks(data, filePath = TASK_FILE) {
  const next = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${next}\n`, "utf-8");
}

async function appendLog(message) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(LOG_DIR, `${stamp}.log`);
  await fs.writeFile(file, `${message}\n`, "utf-8");
  return file;
}

async function readTemplate() {
  return fs.readFile(TEMPLATE_FILE, "utf-8");
}

async function readResponseFile(responseFile) {
  if (!responseFile) throw new Error("No Codex response provided. Use --response or integrate API.");
  return fs.readFile(responseFile, "utf-8");
}

function updateTaskStatus(tasksData, taskId, nextStatus, note) {
  const target = tasksData.tasks.find((item) => item.id === taskId);
  if (!target) throw new Error(`Task ${taskId} not found for status update.`);
  target.status = nextStatus;
  target.updatedAt = new Date().toISOString();
  if (note) target.note = note;
  return tasksData;
}

async function handleSkip(options) {
  if (!options.taskId) throw new Error("Skipping a task requires --task <ID>.");
  const data = await loadTasks();
  await saveTasks(updateTaskStatus(data, options.taskId, "skipped", options.reason ?? "manual skip"));
  await appendLog(`Task ${options.taskId} marked as skipped.`);
  process.stdout.write(`Task ${options.taskId} marked as skipped.\n`);
}

async function handleRun(options) {
  const data = await loadTasks();
  const task = selectTask(data.tasks, options.taskId);
  const template = await readTemplate();
  const prompt = buildPrompt(template, task);

  if (options.dryRun) {
    process.stdout.write(`${prompt}\n`);
    await appendLog(`Dry run for ${task.id}`);
    return;
  }

  const response = await readResponseFile(options.responseFile);
  validateResponse(response);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${task.id}.md`);
  await fs.writeFile(outputPath, response, "utf-8");

  const metadata = buildCommitMetadata(task);
  ensureUniquePrName(new Set(), metadata.prName);

  await saveTasks(updateTaskStatus(data, task.id, "completed", "auto-generated by codex_worker"));
  const logFile = await appendLog(
    JSON.stringify(
      {
        taskId: task.id,
        outputPath,
        prName: metadata.prName,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.stdout.write(
    [
      `Task ${task.id} completed.`,
      `Prompt saved to stdout? false`,
      `Output saved to ${outputPath}`,
      `Suggested PR name: ${metadata.prName}`,
      `Log file: ${logFile}`,
    ].join("\n") + "\n"
  );
}

async function runCli() {
  try {
    const options = parseArgs(process.argv);
    if (options.command === "skip") {
      await handleSkip(options);
    } else {
      await handleRun(options);
    }
  } catch (err) {
    process.stderr.write(`[codex_worker] ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
