# Codex Automated Development Pipeline (Spec 13)

This document summarizes the local automation workflow powered by the Codex
worker tools that live under `.devtools/`.

## Components

| Artifact | Purpose |
| --- | --- |
| `.devtools/auto_tasks.yaml` | Canonical task backlog. JSON syntax is valid YAML. |
| `.devtools/codex_prompt_template.txt` | Template used to build the final prompt for each Codex run. |
| `.devtools/codex_worker.js` | CLI utility that selects a task, builds the prompt, validates Codex output, and updates the backlog. |
| `.devtools/logs/` | Timestamped logs for every worker invocation. |
| `.github/workflows/codex_nightly.yml` | Nightly + manual workflow that runs the worker in dry‑run mode and archives logs. |

## Running the worker

```bash
# Dry run to inspect the generated prompt
node .devtools/codex_worker.js run --dry-run

# Process a specific task with a captured response
node .devtools/codex_worker.js run --task SPEC13-002 --response /tmp/codex.md

# Mark a task as skipped
node .devtools/codex_worker.js skip --task SPEC13-003 --reason "waiting on design"
```

The worker enforces the commit/PR naming convention `Codex AutoPR - {TASK_ID} {TASK_TITLE}`
and refuses to reuse a previously generated PR title.

## Task file contract

`auto_tasks.yaml` contains an object with a `tasks` array. Each task entry may define:

- `id`: unique identifier (e.g., `SPEC13-005`).
- `title`, `summary`: short descriptors for prompt generation.
- `status`: `pending`, `completed`, or `skipped`.
- `owner`: optional label (default `codex`).
- `path`: the primary file or directory touched by the task.
- `note`, `updatedAt`: maintained automatically by the worker.

Tasks automatically move to `completed` when a response file is accepted and to
`skipped` when `codex_worker skip` is invoked.

## Prompt template placeholders

The template supports the following tokens:

- `{{TASK_ID}}`, `{{TASK_TITLE}}`, `{{TASK_STATUS}}`, `{{TASK_OWNER}}`
- `{{TASK_PATH}}`, `{{TASK_SUMMARY}}`

Additional tokens can be passed via the worker internals when needed.

## Testing

`scripts/__tests__/codex_worker.test.js` uses Vitest to cover three critical paths:

1. YAML/JSON parsing errors during task loading.
2. Empty Codex responses (prevents accidentally marking tasks as complete).
3. Duplicate PR name detection.

Run the full suite via `npm test`.

## CI workflow

The `codex_nightly.yml` workflow installs dependencies, executes the worker in
dry‑run mode (so no tasks are mutated on CI), and uploads everything under
`.devtools/logs` as an artifact for later auditing.

If the worker ever fails, the workflow surfaces the error and the log artifact
can be inspected to determine whether the task file or prompt template needs
adjustments.
