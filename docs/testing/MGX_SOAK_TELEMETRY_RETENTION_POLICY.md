# MGX Soak Telemetry Retention Policy

## Purpose

Gameplay soak needs enough evidence to find freezes, actor mismatches, phase drift, illegal actions, hand-shape contamination, UI control regressions, and mobile overflow without turning every E2E run into a giant text-log dump.

The policy is:

- Normal gameplay and production runtime: telemetry disabled.
- Soak/E2E only: lightweight structured events.
- Passing scenarios: summary plus compact DB rows only.
- Failing scenarios: dump the last N events, screenshot, last snapshot, console/network errors, and invariant violations.
- Do not add more `console.log`-based diagnostics.
- Do not save full snapshots for every action.

## Current Heavy Log Candidates

| Candidate | Location | Problem | Policy |
| --- | --- | --- | --- |
| Full trace JSONL per scenario | `tests/e2e/browser-gameplay-invariant-harness.spec.ts` | Can grow quickly across variants, modes, seeds, and hands | Keep compact rows; full trace only on failure or explicit `SOAK_TRACE_MODE=full` |
| Full browser snapshots | `window.__MGX_GET_GAMEPLAY_SNAPSHOT__` / `collectBrowserGameplaySnapshot.js` | Snapshot includes players, controller state, merge source, raw state | Use only for collection; persist summary fields normally, full `snapshot_json` only on failure |
| Deck debug logs | `[DECK][STATE]` from deck helpers | Extremely noisy and slows test output | Do not increase; gate separately in future behind an explicit debug env |
| BET/opening/merge debug logs | `[BET][PLAYERS]`, `[BET][OPENING_ACTOR]`, `[MERGE][TURN_DEBUG]` | Useful for targeted regression but noisy in broad soak | Treat as temporary targeted logs; soak should store structured actor/phase fields instead |
| Browser console capture | Playwright `page.on("console")` | Capturing everything as text duplicates structured data | Store only error/warn summary normally; retain full console tail only on failure |
| Network capture | Playwright request/response hooks | Full network logging can be large and noisy | Store failures and 5xx rows only; full tail only on failure |
| Reports under `reports/browser-gameplay`, `reports/core5`, etc. | Existing E2E reports | Many JSON files are hard to query and expensive to retain | Keep existing targeted reports; new soak should centralize searchable data in SQLite |

## Always Saved

Always-saved data must be small, structured, and queryable.

### Run Summary

Saved to:

- `reports/soak/<run-id>/summary.json`
- `reports/soak/latest-summary.json`
- `reports/soak/<run-id>/soak.sqlite`

Fields:

- `run_id`
- `started_at`
- `finished_at`
- `git_sha`
- `suite`
- `tier`
- `browser`
- `status`
- scenario counts
- failure counts by invariant

### Scenario Summary

Saved to SQLite and run summary:

- `scenario_id`
- `variant_id`
- `mode`
- `seed`
- `viewport`
- `status`
- `hands_attempted`
- `hands_completed`
- `actions_observed`
- `violations_count`
- `first_failure_type`

### Lightweight Gameplay Events

Saved to SQLite `gameplay_events` only. These rows are the normal query surface.

Allowed columns:

- `event_seq`
- `timestamp`
- `hand_id`
- `action_index`
- `phase`
- `draw_round`
- `bet_round`
- `actor_seat`
- `next_turn`
- `hero_seat`
- `action`
- `legal_actions_json`
- `player_statuses_json`
- `pot`
- `current_bet`
- `stacks_json`
- `cards_count_json`
- `ui_controls_json`

Do not store full `snapshot_json` for passing events.

## Failure-Only Saved

Failure artifacts are written only when a scenario has a P0 invariant violation, action application failure, timeout/freeze, console error trap, or mobile layout trap.

Saved under:

```text
reports/soak/<run-id>/<scenario-id>/
```

Files:

- `summary.json`
- `trace-tail.json`
- `trace-tail.jsonl`
- `screenshot.png`
- `last-gameplay-snapshot.json`
- `console-tail.log`
- `network-tail.json`
- `invariant-violations.json`

Failure-only DB fields:

- `gameplay_events.snapshot_json`
- `invariant_violations.snapshot_json`
- `browser_console_events.text` full tail
- `browser_network_events` failure tail

The full raw snapshot should be written for:

- the failed event
- the previous 5 events
- optionally the next event if recovery/progress occurs

## Never Saved

Do not save:

- Full browser snapshot for every passing action.
- Full deck contents on every action.
- Full hand history payloads for every passing event when summary fields are enough.
- Production user identifiers, email, auth token, or account profile.
- Production DB URLs or credentials.
- Full localStorage/sessionStorage dumps.
- Full network request/response bodies unless a targeted failure needs a sanitized excerpt.
- AI evaluation/counterfactual artifacts in gameplay soak DB.
- Raw screenshots for passing scenarios by default.
- Huge text logs that duplicate DB rows.

## SQLite Schema Policy

The DB schema should support traps using lightweight columns first. Full JSON is allowed only as a failure backstop.

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
  command TEXT
);
```

### `soak_scenarios`

```sql
CREATE TABLE soak_scenarios (
  scenario_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  seed INTEGER,
  viewport TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  status TEXT,
  hands_attempted INTEGER,
  hands_completed INTEGER,
  actions_observed INTEGER,
  first_failure_type TEXT,
  error_message TEXT
);
```

### `gameplay_events`

```sql
CREATE TABLE gameplay_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  hand_id TEXT,
  action_index INTEGER,
  phase TEXT,
  draw_round INTEGER,
  bet_round INTEGER,
  actor_seat INTEGER,
  next_turn INTEGER,
  hero_seat INTEGER,
  action TEXT,
  legal_actions_json TEXT,
  player_statuses_json TEXT,
  pot REAL,
  current_bet REAL,
  stacks_json TEXT,
  cards_count_json TEXT,
  ui_controls_json TEXT,
  snapshot_json TEXT
);
```

Retention rule:

- Passing event: `snapshot_json = NULL`
- Failing event/tail: `snapshot_json = compact raw snapshot`

### `invariant_violations`

```sql
CREATE TABLE invariant_violations (
  violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  event_id INTEGER,
  severity TEXT NOT NULL,
  invariant TEXT NOT NULL,
  message TEXT NOT NULL,
  hand_id TEXT,
  action_index INTEGER,
  phase TEXT,
  actor_seat INTEGER,
  snapshot_json TEXT
);
```

### `browser_console_events`

```sql
CREATE TABLE browser_console_events (
  console_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  retained_reason TEXT NOT NULL
);
```

Retention rule:

- Passing scenario: retain only `error` rows and allowlisted warning counts.
- Failing scenario: retain last N console rows.

### `browser_network_events`

```sql
CREATE TABLE browser_network_events (
  network_id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  method TEXT,
  url TEXT NOT NULL,
  status INTEGER,
  failure TEXT,
  retained_reason TEXT NOT NULL
);
```

Retention rule:

- Passing scenario: retain failed requests and HTTP 5xx only.
- Failing scenario: retain last N network rows.

## Ring Buffer Design

Use ring buffers in the Playwright/helper layer, not production runtime.

Recommended buffers:

| Buffer | Default Size | Contents | Dumped When |
| --- | ---: | --- | --- |
| `eventRing` | 100 | compact gameplay event rows | failure only |
| `snapshotRing` | 25 | compact raw snapshot references or small snapshots | failure only |
| `consoleRing` | 100 | console type/text/timestamp | failure only; errors may also be summarized |
| `networkRing` | 100 | failed/important network rows | failure only |
| `violationRing` | 50 | invariant violation rows | failure only and DB |

Constraints:

- Keep ring rows compact.
- Avoid pushing full deck arrays repeatedly.
- Avoid browser `localStorage` for soak ring buffers.
- Prefer Node-side buffers populated from `page.evaluate` results.
- Browser-side ring buffers are acceptable only behind an explicit E2E/soak flag.

## SQL Trap Inputs

The following traps must use lightweight event fields first:

- same actor/phase repeats too much
- action index not increasing
- actor folded/busted/seat-out
- all-in actor elected during BET
- hero controls visible while hero is not actor
- hero controls hidden while hero is actor
- phase `DRAW` but BET controls visible
- phase `BET` but DRAW controls visible
- Badugi card count not 4
- draw lowball card count not 5
- pot negative
- stack negative
- mobile horizontal overflow
- action button outside viewport
- console error
- network failure or HTTP 5xx

Only when a trap matches should full snapshot tail be persisted.

## Performance Budget

Target budgets for fast soak:

| Item | Budget |
| --- | ---: |
| DB insert per event | < 5 ms average |
| Normal event payload | < 2 KB |
| Passing scenario JSON artifacts | < 50 KB |
| Passing scenario screenshots | 0 |
| Ring buffer memory per scenario | < 5 MB |
| SQLite size for fast run | < 25 MB |
| SQLite size for standard run | < 100 MB |

If a scenario exceeds budget, reduce retained fields before reducing invariant coverage.

## Cleanup and Retention

Local default:

- Keep `reports/soak/latest-summary.json`.
- Keep `reports/soak/latest.sqlite`.
- Keep the last 10 run directories.
- Keep all failing scenario directories until manually archived.
- Passing scenario detail directories may be deleted after summary/SQLite are written.

CI default:

- Upload `summary.json`, `latest-summary.json`, and `soak.sqlite`.
- Upload failure directories only.
- Do not upload passing screenshots.

Suggested cleanup command for future implementation:

```bash
node scripts/cleanupSoakReports.mjs --keep-runs=10 --keep-failures
```

## Production Disablement

Soak telemetry must be disabled by default.

Allowed enablement:

- Playwright process env, e.g. `SOAK_TELEMETRY=1`
- E2E-only init script flag, e.g. `window.__MGX_SOAK_TELEMETRY_ENABLED__ = true`
- Local test helper modules under `tests/e2e/helpers`

Disallowed:

- Production default telemetry collection.
- Production localStorage/sessionStorage event accumulation.
- Backend production DB writes.
- Runtime console spam as telemetry.

## Implementation Priority

1. **Docs and helper design only**
   - finalize schema, retention, ring buffer, and trap policy.
2. **SQLite helper**
   - add test-only `soakDbTelemetry` helper.
   - create schema and insert lightweight run/scenario/event rows.
3. **Fast soak integration**
   - wire only `test:soak:fast` first.
   - persist compact rows and run SQL traps.
4. **Failure artifact dump**
   - dump ring buffers and last snapshot only when a P0 trap or timeout occurs.
5. **Core5/mobile/exhaustive extension**
   - expand after fast soak DB overhead is measured.

## Step A Implementation Notes

Step A introduces the first DB-backed telemetry slice:

- `src/ui/qa/gameplaySoak/sqliteTelemetry.js`
  - creates `reports/soak/<run-id>/soak.sqlite`
  - uses test-only Node helper code and Python standard-library `sqlite3`
  - creates `soak_runs`, `soak_scenarios`, `gameplay_events`, and `invariant_violations`
  - stores lightweight event columns by default
  - leaves `snapshot_json` as `NULL` unless the caller marks a failure/tail event
  - runs the initial SQL traps for actor, control, card-count, pot/stack, and repeat-state checks
- `tests/e2e/helpers/gameplaySoakHarness.ts`
  - wraps Playwright collection
  - uses existing browser snapshot hooks
  - keeps ring buffers in the test process
  - writes failure artifacts only when a P0 violation is observed
- `tests/e2e/gameplay-soak-fast-db-telemetry.spec.ts`
  - smoke-checks DB creation with a lightweight Playwright scenario
  - verifies passing scenarios generate `summary.json` and `soak.sqlite`
  - verifies passing scenarios do not create failure artifact directories
- `npm run test:soak:fast`
  - runs the Step A smoke gate

Step A intentionally does not wire DB writing into every existing soak/browser invariant test yet. Broader Core5/mobile/exhaustive integration should happen after DB size and insert overhead are measured on the fast suite.

## Step B Implementation Notes

Step B wires the same lightweight SQLite path into real Core5 browser progression:

- `tests/e2e/helpers/gameplaySoakHarness.ts`
  - adds seeded `Math.random` injection for soak runs
  - collects a DB event at the initial state and after each action boundary
  - synthesizes a monotonic `action_index` when the browser snapshot does not expose one
  - keeps raw snapshots in an in-process ring buffer only
  - enriches mobile rows with compact viewport/action-box metrics
  - writes DB `invariant_violations` and full snapshot data only when a P0 violation is recorded
- `tests/e2e/helpers/core5SoakE2EHelper.ts`
  - builds Core5 scenario matrices by variant, mode, seed, and viewport
  - opens existing cash/tournament E2E flows without changing gameplay runtime
  - records 10-30 events per scenario by default
- `tests/e2e/gameplay-soak-core5-cash.spec.ts`
  - runs Badugi, D01, D02, S01, and S02 cash progression over multiple seeds
- `tests/e2e/gameplay-soak-core5-tournament.spec.ts`
  - runs Core5 tournament no-freeze/action-progression smoke scenarios
- `tests/e2e/gameplay-soak-mobile-portrait.spec.ts`
  - runs Core5 mobile portrait progression and stores overflow/action-button metrics in SQLite
- `src/ui/qa/gameplaySoak/sqliteTelemetry.js`
  - adds SQL traps for action-index regression and mobile viewport/action-button overflow

New scripts:

```bash
npm run test:soak:core5
npm run test:soak:mobile
npm run test:soak:exhaustive
```

Useful summary queries:

```sql
select variant_id, mode, count(*) as events
from gameplay_events
group by variant_id, mode;

select invariant, count(*)
from invariant_violations
group by invariant;
```

Step B keeps passing artifacts compact: `summary.json`, `latest-summary.json`, and `soak.sqlite`. Scenario directories with screenshots and tail snapshots are still failure-only.

## Expected Impact

Compared with full JSON/text traces:

- Lower stdout volume because no new `console.log` diagnostics are added.
- Smaller passing artifacts because full snapshots and screenshots are omitted.
- Better bug search because SQL traps query normalized columns.
- Faster triage because failures still keep ring-buffer context and screenshots.
- Production performance unchanged because telemetry is E2E-only and off by default.
