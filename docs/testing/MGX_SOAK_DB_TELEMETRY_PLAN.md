# MGX Soak DB Telemetry Plan

## Executive Summary

MGX already has browser gameplay snapshots, JSON/JSONL reports, console capture, and backend hand/action persistence. The missing layer is a searchable, test-only event database for soak runs. The proposed design adds a Playwright-side SQLite artifact under `reports/soak/`, populated from existing browser E2E hooks such as `window.__MGX_GET_GAMEPLAY_SNAPSHOT__`, browser console/network traps, and invariant checker output.

This must remain separate from production persistence:

- No production DB writes.
- No `badugi_hand_logs`, `badugi_action_logs`, or `play_feedback_results` reuse for soak telemetry.
- No user PII.
- No gameplay, engine, roundFlow, backend, or RL behavior changes.
- SQLite files are test artifacts only, for SQL traps and release evidence.

## Current Logging Inventory

| Source | Location | Current Format | Useful For | Gaps |
| --- | --- | --- | --- | --- |
| Browser gameplay snapshot | `src/ui/qa/collectBrowserGameplaySnapshot.js` via `window.__MGX_GET_GAMEPLAY_SNAPSHOT__` | JS object returned to Playwright | phase, actor, players, pot, UI controls, snapshot merge source, cross-variant violations | Not persisted in searchable DB |
| Browser invariant harness | `tests/e2e/browser-gameplay-invariant-harness.spec.ts` | `reports/browser-gameplay/*.json`, `*.jsonl` | actor mismatch, betting closure, stale phase, pot mismatch, action reopen | JSONL is grep-able but not SQL-queryable |
| Runtime telemetry | `src/ui/qa/browserGameplayRuntimeTelemetry.js` | JSON summary | action duration, hand duration, waits, assertions, screenshots | Aggregate only; not row-level gameplay events |
| Mobile freeze detector | `src/ui/qa/mobileFreezeDetector.js` | exported freeze report object | waiting freeze, trace tail, console errors | Focused on mobile freeze only |
| Browser trace | `src/ui/qa/browserGameplayTrace.js` | in-memory `window.__MGX_GAMEPLAY_TRACE__` | browser-side trace rows | Volatile unless copied by Playwright |
| Playwright console/network | Existing helpers such as `captureFatalBrowserErrors` | arrays or screenshots on failure | console errors, request failures | Not normalized into event tables |
| Hand log API | `backend/app/api/badugi_log.py` | production/backend DB | completed Badugi hands, actions, results | Not every step; Badugi-specific; production persistence |
| Generic history API | `backend/app/api/history.py` | in-memory backend buffer | mixed hand history/replay | Not durable per test run; no invariant rows |
| AI evaluation reports | `reports/ai-eval/` | JSON | counterfactual/pro eval | Explicitly separate from gameplay soak |

## Existing Production/Test DB Models

Production/backend persistence already covers these tables:

- `badugi_hand_logs`
  - hand-level Badugi log: `hand_id`, `table_id`, `tournament_id`, `level`, `metadata`
- `badugi_hand_actions`
  - structured actions attached to `badugi_hand_logs`: seat, player, action, amount, round, phase
- `badugi_hand_results`
  - final stacks, winners, pot share
- `badugi_action_logs`
  - frontend action telemetry with metadata, action type, paid/to_call, stack/bet before/after
- `play_feedback_results`
  - AI/cash/tournament feedback payloads and responses

These are not enough for soak traps because they do not consistently store every browser/controller snapshot, UI controls state, card counts, legal actions, console errors, network failures, or invariant violations across all Core5 variants.

## DB-Backed Telemetry Architecture

### Data Flow

1. Playwright launches a scenario.
2. Browser state is captured with existing hooks:
   - `window.__MGX_GET_GAMEPLAY_SNAPSHOT__({ label, mode, action })`
   - `window.__BADUGI_E2E__.getStateSnapshot()`
   - `window.__BADUGI_E2E__.getPhaseState()`
3. Node-side test code evaluates invariants.
4. Node-side DB writer inserts:
   - run metadata
   - scenario metadata
   - gameplay event rows
   - invariant violation rows
   - console/network rows
5. JSON/screenshot artifacts remain for failure detail.
6. SQLite file is written to `reports/soak/<run-id>/soak.sqlite`.
7. A copied/latest pointer may be written to `reports/soak/latest.sqlite`.

### Why Node-Side SQLite

Preferred write path:

```text
browser page.evaluate(snapshot) -> Playwright test process -> SQLite artifact
```

Do not write SQLite from the browser. It avoids bundling a DB client into the frontend and avoids gameplay runtime changes.

Implementation options:

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| `better-sqlite3` devDependency | Simple synchronous inserts, reliable in Playwright process | Native module install | Best short-term option |
| `sqlite3` devDependency | Common async API | More callback/async ceremony | Acceptable fallback |
| Node 24 `node:sqlite` | No dependency if stable/available | Version/runtime support must be confirmed; may be experimental | Evaluate before adopting |
| Backend SQLAlchemy test DB | Existing Python stack | Couples soak to backend process and schema | Avoid for V1 |

## Artifact Layout

Recommended:

```text
reports/soak/
  latest-summary.json
  latest.sqlite
  <run-id>/
    soak.sqlite
    summary.json
    <scenario-id>/
      summary.json
      trace.json
      trace.jsonl
      screenshot.png
      console.log
      network.log
      last-gameplay-snapshot.json
```

The SQLite DB is the searchable source. JSON/screenshot files remain failure evidence and human-readable context.

## Schema

### `soak_runs`

```sql
CREATE TABLE soak_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  git_sha TEXT,
  suite TEXT NOT NULL,
  tier TEXT,
  browser TEXT,
  project TEXT,
  status TEXT,
  node_version TEXT,
  playwright_version TEXT,
  command TEXT
);
```

### `soak_scenarios`

```sql
CREATE TABLE soak_scenarios (
  scenario_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES soak_runs(run_id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  seed INTEGER,
  viewport TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  status TEXT,
  started_at TEXT,
  finished_at TEXT,
  max_hands INTEGER,
  max_actions INTEGER,
  error_message TEXT
);

CREATE INDEX idx_soak_scenarios_run ON soak_scenarios(run_id);
CREATE INDEX idx_soak_scenarios_variant_mode ON soak_scenarios(variant_id, mode);
```

### `gameplay_events`

```sql
CREATE TABLE gameplay_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  event_seq INTEGER NOT NULL,
  label TEXT,
  hand_id TEXT,
  action_index INTEGER,
  phase TEXT,
  draw_round INTEGER,
  bet_round INTEGER,
  actor_seat INTEGER,
  next_turn INTEGER,
  hero_seat INTEGER,
  action TEXT,
  action_payload_json TEXT,
  legal_actions_json TEXT,
  player_statuses_json TEXT,
  pot REAL,
  current_bet REAL,
  stacks_json TEXT,
  cards_count_json TEXT,
  ui_controls_json TEXT,
  snapshot_json TEXT
);

CREATE INDEX idx_gameplay_events_scenario_seq ON gameplay_events(scenario_id, event_seq);
CREATE INDEX idx_gameplay_events_hand ON gameplay_events(scenario_id, hand_id);
CREATE INDEX idx_gameplay_events_phase_actor ON gameplay_events(phase, actor_seat);
```

### `invariant_violations`

```sql
CREATE TABLE invariant_violations (
  violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES gameplay_events(event_id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  invariant TEXT NOT NULL,
  message TEXT NOT NULL,
  hand_id TEXT,
  action_index INTEGER,
  phase TEXT,
  actor_seat INTEGER,
  snapshot_json TEXT
);

CREATE INDEX idx_invariant_violations_scenario ON invariant_violations(scenario_id);
CREATE INDEX idx_invariant_violations_severity ON invariant_violations(severity, invariant);
```

### Optional V1.1 Tables

```sql
CREATE TABLE browser_console_events (
  console_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE browser_network_events (
  network_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  method TEXT,
  url TEXT NOT NULL,
  status INTEGER,
  failure TEXT
);

CREATE TABLE sql_trap_results (
  trap_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES soak_runs(run_id) ON DELETE CASCADE,
  trap_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  matched_count INTEGER NOT NULL,
  sample_json TEXT
);
```

## Event Normalization

Each `gameplay_events` row should derive normalized columns from the raw snapshot:

- `phase`: uppercase canonical phase from controller/snapshot/UI terminal normalization.
- `actor_seat`: canonical controller actor; `NULL` in terminal states.
- `hero_seat`: currently `0`, but store explicitly for future table seat assignments.
- `action`: action attempted/applied by harness, e.g. `action-call`, `controller:draw`, `auto-cpu`.
- `legal_actions_json`: interactable action test IDs from browser UI.
- `player_statuses_json`: array of `{ seat, stack, folded, allIn, seatOut, busted, lastAction }`.
- `cards_count_json`: map by seat, e.g. `{ "0": 4, "1": 4 }`.
- `ui_controls_json`: hero controls visible, betting controls visible, draw controls visible, displayed phase, overflow metrics.
- `snapshot_json`: raw compact snapshot for debugging.

## SQL Trap Catalog

### Actor and Turn Traps

Folded/busted/seat-out actor:

```sql
SELECT scenario_id, event_seq, hand_id, phase, actor_seat, player_statuses_json
FROM gameplay_events
WHERE actor_seat IS NOT NULL
  AND (
    json_extract(player_statuses_json, '$[' || actor_seat || '].folded') = 1
    OR json_extract(player_statuses_json, '$[' || actor_seat || '].busted') = 1
    OR json_extract(player_statuses_json, '$[' || actor_seat || '].seatOut') = 1
  );
```

All-in actor elected during BET:

```sql
SELECT scenario_id, event_seq, hand_id, actor_seat
FROM gameplay_events
WHERE phase = 'BET'
  AND actor_seat IS NOT NULL
  AND json_extract(player_statuses_json, '$[' || actor_seat || '].allIn') = 1;
```

Hero controls visible while hero is not actor:

```sql
SELECT scenario_id, event_seq, hand_id, phase, actor_seat, hero_seat, ui_controls_json
FROM gameplay_events
WHERE json_extract(ui_controls_json, '$.heroControlsVisible') = 1
  AND actor_seat IS NOT hero_seat
  AND phase NOT IN ('HAND_RESULT', 'SHOWDOWN', 'WAITING_NEXT_HAND', 'COMPLETE', 'TERMINAL');
```

Hero controls hidden while hero is actor:

```sql
SELECT scenario_id, event_seq, hand_id, phase, actor_seat, hero_seat, ui_controls_json
FROM gameplay_events
WHERE actor_seat = hero_seat
  AND json_extract(ui_controls_json, '$.heroControlsVisible') = 0
  AND phase NOT IN ('HAND_RESULT', 'SHOWDOWN', 'WAITING_NEXT_HAND', 'COMPLETE', 'TERMINAL');
```

### Phase and Control Traps

DRAW phase with BET controls:

```sql
SELECT scenario_id, event_seq, hand_id, ui_controls_json
FROM gameplay_events
WHERE phase = 'DRAW'
  AND json_extract(ui_controls_json, '$.bettingControlsVisible') = 1;
```

BET phase with DRAW controls:

```sql
SELECT scenario_id, event_seq, hand_id, ui_controls_json
FROM gameplay_events
WHERE phase = 'BET'
  AND json_extract(ui_controls_json, '$.drawControlsVisible') = 1;
```

Stale DRAW RUSHER during BET:

```sql
SELECT scenario_id, event_seq, hand_id, ui_controls_json
FROM gameplay_events
WHERE phase = 'BET'
  AND upper(json_extract(ui_controls_json, '$.displayedPhase')) LIKE '%DRAW RUSHER%';
```

### Hand Shape and Variant Contamination Traps

Badugi hero hand not 4 cards:

```sql
SELECT scenario_id, event_seq, hand_id, cards_count_json
FROM gameplay_events ge
JOIN soak_scenarios ss USING (scenario_id)
WHERE lower(ss.variant_id) = 'badugi'
  AND json_extract(cards_count_json, '$.0') IS NOT NULL
  AND json_extract(cards_count_json, '$.0') != 4;
```

Draw lowball hero hand not 5 cards:

```sql
SELECT scenario_id, event_seq, hand_id, variant_id, cards_count_json
FROM gameplay_events ge
JOIN soak_scenarios ss USING (scenario_id)
WHERE ss.variant_id IN ('D01', 'D02', 'S01', 'S02')
  AND json_extract(cards_count_json, '$.0') IS NOT NULL
  AND json_extract(cards_count_json, '$.0') != 5;
```

Cross-variant leakage from invariant rows:

```sql
SELECT *
FROM invariant_violations
WHERE invariant IN ('CROSS_VARIANT', 'HAND_SHAPE')
   OR message LIKE '%variant%';
```

### Pot/Stack Traps

Negative pot:

```sql
SELECT scenario_id, event_seq, hand_id, pot
FROM gameplay_events
WHERE pot < 0;
```

Negative stack:

```sql
SELECT scenario_id, event_seq, hand_id, player_statuses_json
FROM gameplay_events, json_each(player_statuses_json)
WHERE json_extract(json_each.value, '$.stack') < 0;
```

### Freeze and No-Progress Traps

Same actor/phase repeats too many times:

```sql
WITH keyed AS (
  SELECT
    scenario_id,
    event_seq,
    hand_id,
    phase,
    actor_seat,
    action_index,
    pot,
    current_bet,
    lag(hand_id) OVER w AS prev_hand_id,
    lag(phase) OVER w AS prev_phase,
    lag(actor_seat) OVER w AS prev_actor,
    lag(action_index) OVER w AS prev_action_index,
    lag(pot) OVER w AS prev_pot,
    lag(current_bet) OVER w AS prev_current_bet
  FROM gameplay_events
  WINDOW w AS (PARTITION BY scenario_id ORDER BY event_seq)
),
unchanged AS (
  SELECT *,
    CASE WHEN hand_id = prev_hand_id
      AND phase = prev_phase
      AND actor_seat IS prev_actor
      AND action_index IS prev_action_index
      AND pot IS prev_pot
      AND current_bet IS prev_current_bet
    THEN 1 ELSE 0 END AS same_as_previous
  FROM keyed
)
SELECT scenario_id, hand_id, phase, actor_seat, COUNT(*) AS repeat_count
FROM unchanged
WHERE same_as_previous = 1
GROUP BY scenario_id, hand_id, phase, actor_seat
HAVING repeat_count >= 5;
```

Hand never reaches terminal after max actions:

```sql
SELECT scenario_id, hand_id, COUNT(*) AS event_count,
       MAX(CASE WHEN phase IN ('HAND_RESULT', 'SHOWDOWN', 'WAITING_NEXT_HAND', 'COMPLETE', 'TERMINAL') THEN 1 ELSE 0 END) AS reached_terminal
FROM gameplay_events
GROUP BY scenario_id, hand_id
HAVING reached_terminal = 0 AND event_count >= 80;
```

Action index stops increasing:

```sql
SELECT scenario_id, hand_id, phase, actor_seat, COUNT(*) AS repeats
FROM gameplay_events
WHERE action_index IS NOT NULL
GROUP BY scenario_id, hand_id, phase, actor_seat, action_index
HAVING repeats >= 5;
```

### Console/Network Traps

Unhandled browser errors:

```sql
SELECT *
FROM browser_console_events
WHERE type = 'error'
  AND text NOT LIKE '%favicon%'
  AND text NOT LIKE '%ResizeObserver loop%';
```

Request failures:

```sql
SELECT *
FROM browser_network_events
WHERE type = 'requestfailed'
   OR status >= 500;
```

## Minimal Implementation Plan

### Step 1: Add SQLite Writer Utility

Add a test-only utility, for example:

```text
tests/e2e/helpers/soakDbTelemetry.ts
```

Responsibilities:

- `openSoakDb({ runId, suite })`
- create tables if missing
- insert `soak_runs`
- insert/update `soak_scenarios`
- insert `gameplay_events`
- insert `invariant_violations`
- insert console/network rows
- run SQL traps after scenario or after run
- close DB

Keep it imported only by soak E2E specs.

### Step 2: Normalize Existing Snapshot Rows

Map existing `collectBrowserGameplaySnapshot` output into DB columns. Do not change the snapshot producer unless a required field is missing. Prefer derived JSON fields on the Node side.

### Step 3: Wire Into Soak Harness

For each collect point:

1. capture snapshot
2. evaluate invariant checker
3. insert `gameplay_events`
4. insert violations
5. keep JSONL trace behavior unchanged

### Step 4: Add SQL Trap Runner

Run trap SQL after each scenario and at run end. Insert trap results into `sql_trap_results`. Fail the Playwright test if any P0 trap returns rows.

### Step 5: Report Links

Write:

- `reports/soak/<run-id>/soak.sqlite`
- `reports/soak/latest.sqlite`
- `reports/soak/<run-id>/summary.json` with `sqlitePath` and trap counts

## Production DB Separation

The soak DB must not share:

- backend database URL
- backend SQLAlchemy models
- production migrations
- user identifiers
- production hand history tables
- feedback persistence tables

Recommended guardrails:

- DB path must be under `reports/soak/`.
- Refuse paths outside repo `reports/soak/` unless `SOAK_DB_ALLOW_EXTERNAL=1`.
- Use synthetic `run_id` and `scenario_id`.
- Store `hero_seat`, not real user identity.
- Store synthetic player labels only when already present in snapshots.
- Never POST soak events to backend APIs.

## JSON Reports vs SQLite

| Artifact | Purpose |
| --- | --- |
| `summary.json` | Human-readable run status and CI artifact preview |
| `trace.jsonl` | Compact chronological debugging context |
| `screenshot.png` | Visual failure proof |
| `console.log` / `network.log` | Raw browser/browser-network failure evidence |
| `soak.sqlite` | Queryable run database and trap engine |

SQLite should not replace screenshots or trace JSON. It adds repeatable trap queries and aggregate analytics.

## Priority

1. **P0: Event DB writer and schema**
   - create SQLite DB
   - insert run/scenario/event/violation rows
   - write under `reports/soak/`
2. **P0: Core SQL traps**
   - ineligible actor
   - hero controls mismatch
   - BET/DRAW control mismatch
   - hand shape mismatch
   - negative pot/stack
   - no-progress repeat
3. **P1: Console/network tables**
   - page errors
   - console errors
   - request failures
4. **P1: Trap result table**
   - store trap name, severity, count, sample rows
5. **P2: CLI query helper**
   - `node scripts/querySoakDb.mjs reports/soak/latest.sqlite --trap freeze`
6. **P2: Trend reports**
   - compare latest run with previous run
   - flake rate by variant/mode/seed

## Suggested Release Gate

Fast PR gate:

- JSON summary status must be `PASS`.
- SQLite P0 traps must return zero rows.

Release/nightly gate:

- Core5 cash+tournament across configured seed tier.
- Mobile portrait tier across 375/390/430.
- Cross-variant sequence.
- `soak.sqlite` archived with run artifacts.

## Open Questions Before Implementation

- Confirm SQLite library:
  - prefer `better-sqlite3` if native install is acceptable
  - otherwise evaluate Node 24 `node:sqlite`
- Decide whether `latest.sqlite` is a copy or symlink; copy is safer for CI artifacts.
- Decide retention policy for `reports/soak/<run-id>/soak.sqlite` because exhaustive runs can grow quickly.
- Decide exact maximum row count for success traces; failure scenarios should keep full detail.
