import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SOAK_REPORT_ROOT } from "./artifacts.js";

const PYTHON_SQLITE_BRIDGE = String.raw`
import json
import sqlite3
import sys

payload = json.load(sys.stdin)
db_path = payload["dbPath"]
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA synchronous=NORMAL")
conn.execute("PRAGMA foreign_keys=ON")

SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS soak_runs (
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS soak_scenarios (
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
      error_message TEXT,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(run_id) REFERENCES soak_runs(run_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS gameplay_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      seed INTEGER,
      viewport TEXT,
      event_seq INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL,
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
      card_counts_json TEXT,
      ui_controls_json TEXT,
      snapshot_json TEXT,
      FOREIGN KEY(scenario_id) REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS invariant_violations (
      violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      event_seq INTEGER,
      severity TEXT NOT NULL,
      invariant TEXT NOT NULL,
      message TEXT NOT NULL,
      hand_id TEXT,
      action_index INTEGER,
      phase TEXT,
      actor_seat INTEGER,
      snapshot_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(scenario_id) REFERENCES soak_scenarios(scenario_id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_soak_scenarios_run ON soak_scenarios(run_id)",
    "CREATE INDEX IF NOT EXISTS idx_gameplay_events_scenario_seq ON gameplay_events(scenario_id, event_seq)",
    "CREATE INDEX IF NOT EXISTS idx_gameplay_events_phase_actor ON gameplay_events(phase, actor_seat)",
    "CREATE INDEX IF NOT EXISTS idx_invariant_violations_severity ON invariant_violations(severity, invariant)",
]

for statement in SCHEMA:
    conn.execute(statement)

if payload.get("query"):
    conn.row_factory = sqlite3.Row
    rows = [dict(row) for row in conn.execute(payload["query"]).fetchall()]
    counts = {}
    for table in ["soak_runs", "soak_scenarios", "gameplay_events", "invariant_violations"]:
        counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()
    print(json.dumps({"ok": True, "counts": counts, "rows": rows}))
    sys.exit(0)

def insert_run(row):
    conn.execute(
        """
        INSERT INTO soak_runs (run_id, started_at, finished_at, git_sha, suite, tier, browser, project, status, command)
        VALUES (:run_id, :started_at, :finished_at, :git_sha, :suite, :tier, :browser, :project, :status, :command)
        ON CONFLICT(run_id) DO UPDATE SET
          finished_at=excluded.finished_at,
          git_sha=excluded.git_sha,
          suite=excluded.suite,
          tier=excluded.tier,
          browser=excluded.browser,
          project=excluded.project,
          status=excluded.status,
          command=excluded.command
        """,
        row,
    )

def insert_scenario(row):
    conn.execute(
        """
        INSERT INTO soak_scenarios (
          scenario_id, run_id, variant_id, mode, seed, viewport, viewport_width, viewport_height,
          status, hands_attempted, hands_completed, actions_observed, first_failure_type, error_message,
          started_at, finished_at
        )
        VALUES (
          :scenario_id, :run_id, :variant_id, :mode, :seed, :viewport, :viewport_width, :viewport_height,
          :status, :hands_attempted, :hands_completed, :actions_observed, :first_failure_type, :error_message,
          :started_at, :finished_at
        )
        ON CONFLICT(scenario_id) DO UPDATE SET
          status=excluded.status,
          hands_attempted=excluded.hands_attempted,
          hands_completed=excluded.hands_completed,
          actions_observed=excluded.actions_observed,
          first_failure_type=excluded.first_failure_type,
          error_message=excluded.error_message,
          finished_at=excluded.finished_at
        """,
        row,
    )

def insert_event(row):
    conn.execute(
        """
        INSERT INTO gameplay_events (
          run_id, scenario_id, variant_id, mode, seed, viewport, event_seq, timestamp, created_at,
          hand_id, action_index, phase, draw_round, bet_round, actor_seat, next_turn, hero_seat,
          action, legal_actions_json, player_statuses_json, pot, current_bet, stacks_json,
          card_counts_json, ui_controls_json, snapshot_json
        )
        VALUES (
          :run_id, :scenario_id, :variant_id, :mode, :seed, :viewport, :event_seq, :timestamp, :created_at,
          :hand_id, :action_index, :phase, :draw_round, :bet_round, :actor_seat, :next_turn, :hero_seat,
          :action, :legal_actions_json, :player_statuses_json, :pot, :current_bet, :stacks_json,
          :card_counts_json, :ui_controls_json, :snapshot_json
        )
        """,
        row,
    )

def insert_violation(row):
    conn.execute(
        """
        INSERT INTO invariant_violations (
          run_id, scenario_id, event_seq, severity, invariant, message, hand_id, action_index,
          phase, actor_seat, snapshot_json, created_at
        )
        VALUES (
          :run_id, :scenario_id, :event_seq, :severity, :invariant, :message, :hand_id, :action_index,
          :phase, :actor_seat, :snapshot_json, :created_at
        )
        """,
        row,
    )

for row in payload.get("runs", []):
    insert_run(row)
for row in payload.get("scenarios", []):
    insert_scenario(row)
for row in payload.get("events", []):
    insert_event(row)
for row in payload.get("violations", []):
    insert_violation(row)

TRAPS = {
  "actor_ineligible": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, phase, actor_seat
      FROM gameplay_events
      WHERE actor_seat IS NOT NULL
        AND phase IN ('BET', 'DRAW')
        AND (
          COALESCE(json_extract(player_statuses_json, '$[' || actor_seat || '].folded'), 0) = 1
          OR COALESCE(json_extract(player_statuses_json, '$[' || actor_seat || '].busted'), 0) = 1
          OR COALESCE(json_extract(player_statuses_json, '$[' || actor_seat || '].seatOut'), 0) = 1
        )
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "all_in_bet_actor": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, phase, actor_seat
      FROM gameplay_events
      WHERE phase = 'BET'
        AND actor_seat IS NOT NULL
        AND COALESCE(json_extract(player_statuses_json, '$[' || actor_seat || '].allIn'), 0) = 1
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "hero_controls_visible_not_actor": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, phase, actor_seat, hero_seat
      FROM gameplay_events
      WHERE COALESCE(json_extract(ui_controls_json, '$.heroControlsVisible'), 0) = 1
        AND (actor_seat IS NULL OR actor_seat != hero_seat)
        AND phase IN ('BET', 'DRAW')
        AND actor_seat IS NOT NULL
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "hero_controls_hidden_for_actor": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, phase, actor_seat, hero_seat
      FROM gameplay_events
      WHERE actor_seat = hero_seat
        AND COALESCE(json_extract(ui_controls_json, '$.heroControlsVisible'), 0) = 0
        AND phase IN ('BET', 'DRAW')
        AND actor_seat IS NOT NULL
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "draw_phase_bet_controls": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, ui_controls_json
      FROM gameplay_events
      WHERE phase = 'DRAW'
        AND actor_seat IS NOT NULL
        AND COALESCE(json_extract(ui_controls_json, '$.bettingControlsVisible'), 0) = 1
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "bet_phase_draw_controls": """
    WITH matches AS (
      SELECT scenario_id, event_seq, hand_id, ui_controls_json
      FROM gameplay_events
      WHERE phase = 'BET'
        AND actor_seat IS NOT NULL
        AND COALESCE(json_extract(ui_controls_json, '$.drawControlsVisible'), 0) = 1
    )
    SELECT *
    FROM matches
    WHERE EXISTS (
      SELECT 1 FROM matches previous
      WHERE previous.scenario_id = matches.scenario_id
        AND previous.event_seq = matches.event_seq - 1
    )
  """,
  "badugi_card_count": """
    SELECT scenario_id, event_seq, hand_id, variant_id, card_counts_json
    FROM gameplay_events
    WHERE lower(variant_id) = 'badugi'
      AND json_extract(card_counts_json, '$.0') IS NOT NULL
      AND json_extract(card_counts_json, '$.0') != 4
  """,
  "draw_lowball_card_count": """
    SELECT scenario_id, event_seq, hand_id, variant_id, card_counts_json
    FROM gameplay_events
    WHERE variant_id IN ('D01', 'D02', 'S01', 'S02')
      AND json_extract(card_counts_json, '$.0') IS NOT NULL
      AND json_extract(card_counts_json, '$.0') != 5
  """,
  "negative_pot": """
    SELECT scenario_id, event_seq, hand_id, pot
    FROM gameplay_events
    WHERE pot < 0
  """,
  "negative_stack": """
    SELECT gameplay_events.scenario_id, event_seq, hand_id, json_each.value
    FROM gameplay_events, json_each(player_statuses_json)
    WHERE json_extract(json_each.value, '$.stack') < 0
  """,
  "action_index_regression": """
    WITH ordered AS (
      SELECT
        scenario_id,
        event_seq,
        hand_id,
        action_index,
        LAG(action_index) OVER (PARTITION BY scenario_id ORDER BY event_seq) AS previous_action_index
      FROM gameplay_events
      WHERE action_index IS NOT NULL
    )
    SELECT scenario_id, event_seq, hand_id, action_index, previous_action_index
    FROM ordered
    WHERE previous_action_index IS NOT NULL
      AND action_index < previous_action_index
  """,
  "mobile_horizontal_overflow": """
    SELECT scenario_id, event_seq, hand_id, ui_controls_json
    FROM gameplay_events
    WHERE COALESCE(json_extract(ui_controls_json, '$.horizontalOverflow'), 0) > 2
  """,
  "mobile_action_outside_viewport": """
    SELECT gameplay_events.scenario_id, event_seq, hand_id, ui_controls_json
    FROM gameplay_events
    JOIN soak_scenarios ON soak_scenarios.scenario_id = gameplay_events.scenario_id,
      json_each(json_extract(ui_controls_json, '$.actionBoxes')) AS box
    WHERE soak_scenarios.viewport_width IS NOT NULL
      AND soak_scenarios.viewport_height IS NOT NULL
      AND (
        json_extract(box.value, '$.x') < -1
        OR json_extract(box.value, '$.y') < -1
        OR json_extract(box.value, '$.right') > soak_scenarios.viewport_width + 1
        OR json_extract(box.value, '$.bottom') > soak_scenarios.viewport_height + 1
      )
  """,
  "same_actor_phase_repeat": """
    SELECT scenario_id, hand_id, phase, actor_seat, COUNT(*) AS repeat_count
    FROM gameplay_events
    WHERE phase IN ('BET', 'DRAW')
      AND actor_seat IS NOT NULL
    GROUP BY scenario_id, hand_id, phase, actor_seat, action_index
    HAVING repeat_count >= :repeat_threshold
  """,
}

trap_results = []
repeat_threshold = int(payload.get("repeatThreshold", 6))
if payload.get("runTraps"):
    conn.row_factory = sqlite3.Row
    for name, sql in TRAPS.items():
        all_rows = [dict(row) for row in conn.execute(sql, {"repeat_threshold": repeat_threshold}).fetchall()]
        trap_results.append({
            "trap": name,
            "severity": "P0",
            "matched_count": len(all_rows),
            "sample": all_rows[:20],
        })

counts = {}
for table in ["soak_runs", "soak_scenarios", "gameplay_events", "invariant_violations"]:
    counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

conn.commit()
conn.close()
print(json.dumps({"ok": True, "counts": counts, "traps": trap_results}))
`;

function nowIso() {
  return new Date().toISOString();
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

function bool(value) {
  return Boolean(value) ? 1 : 0;
}

function ensureSafeDbPath(dbPath) {
  const resolved = path.resolve(dbPath);
  const root = path.resolve(SOAK_REPORT_ROOT);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== path.join(root, "latest.sqlite")) {
    if (process.env.SOAK_DB_ALLOW_EXTERNAL !== "1") {
      throw new Error(`Refusing to write soak sqlite outside ${root}: ${resolved}`);
    }
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function runPythonSqlite(payload) {
  const result = spawnSync("python3", ["-c", PYTHON_SQLITE_BRIDGE], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`sqlite telemetry bridge failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout || "{}");
}

function playerStatuses(players = []) {
  return players.map((player, seat) => ({
    seat,
    stack: Number(player?.stack ?? 0),
    folded: bool(player?.folded || player?.hasFolded),
    allIn: bool(player?.allIn),
    seatOut: bool(player?.seatOut || player?.sittingOut || player?.isSittingOut),
    busted: bool(player?.isBusted || player?.busted),
    lastAction: player?.lastAction ?? null,
  }));
}

function stacksBySeat(players = []) {
  return Object.fromEntries(players.map((player, seat) => [seat, Number(player?.stack ?? 0)]));
}

function cardCountsBySeat(players = []) {
  return Object.fromEntries(
    players.map((player, seat) => [seat, Array.isArray(player?.hand) ? player.hand.length : null]),
  );
}

function uiControls(ui = {}) {
  const visibleActions = Array.isArray(ui.visibleActions) ? ui.visibleActions : [];
  return {
    heroControlsVisible: bool(ui.heroControlsVisible || visibleActions.length > 0),
    bettingControlsVisible: bool(
      ui.bettingControlsVisible ||
        visibleActions.some((id) => ["action-check", "action-call", "action-raise", "action-fold"].includes(id)),
    ),
    drawControlsVisible: bool(ui.drawControlsVisible || visibleActions.includes("action-draw-selected")),
    displayedPhase: ui.displayedPhase ?? null,
    resultVisible: bool(ui.resultVisible),
    nextHandVisible: bool(ui.nextHandVisible),
    visibleActions,
    horizontalOverflow: ui.horizontalOverflow ?? null,
    actionBoxes: Array.isArray(ui.actionBoxes) ? ui.actionBoxes : [],
  };
}

export function normalizeGameplayEvent({ run, scenario, row, action = null, includeSnapshot = false, eventSeq = 0 }) {
  const controller = row?.controller ?? {};
  const players = controller.players ?? [];
  const phase = normalizePhase(row?.phase);
  return {
    run_id: run.run_id,
    scenario_id: scenario.scenario_id,
    variant_id: scenario.variant_id,
    mode: scenario.mode,
    seed: scenario.seed ?? null,
    viewport: scenario.viewport ?? null,
    event_seq: eventSeq,
    timestamp: Number(row?.timestamp ?? Date.now()),
    created_at: nowIso(),
    hand_id: row?.handId ?? null,
    action_index: row?.actionIndex ?? null,
    phase,
    draw_round: row?.drawRound ?? null,
    bet_round: row?.betRound ?? null,
    actor_seat: controller.actorSeat ?? null,
    next_turn: controller.nextTurn ?? null,
    hero_seat: row?.ui?.heroSeat ?? 0,
    action: action?.clickedAction ?? action?.type ?? row?.action?.clickedAction ?? row?.action?.type ?? null,
    legal_actions_json: json(row?.ui?.visibleActions ?? []),
    player_statuses_json: json(playerStatuses(players)),
    pot: Number(controller.pot ?? 0),
    current_bet: Number(controller.currentBet ?? 0),
    stacks_json: json(stacksBySeat(players)),
    card_counts_json: json(cardCountsBySeat(players)),
    ui_controls_json: json(uiControls(row?.ui ?? {})),
    snapshot_json: includeSnapshot ? json(row) : null,
  };
}

export function normalizeInvariantViolation({ run, scenario, eventSeq = null, row = null, violation, includeSnapshot = false }) {
  return {
    run_id: run.run_id,
    scenario_id: scenario.scenario_id,
    event_seq: eventSeq,
    severity: violation?.severity ?? "P0",
    invariant: violation?.type ?? violation?.invariant ?? "UNKNOWN",
    message: violation?.message ?? "Invariant violation",
    hand_id: row?.handId ?? null,
    action_index: row?.actionIndex ?? null,
    phase: normalizePhase(row?.phase),
    actor_seat: row?.controller?.actorSeat ?? null,
    snapshot_json: includeSnapshot ? json(row) : null,
    created_at: nowIso(),
  };
}

export function createSoakSqliteTelemetry({
  dbPath,
  runId,
  suite = "gameplay-soak",
  tier = process.env.SOAK_TIER ?? "fast",
  gitSha = process.env.GIT_SHA ?? null,
  browser = null,
  project = null,
  command = process.env.npm_lifecycle_event ?? null,
} = {}) {
  if (!dbPath) throw new Error("dbPath is required");
  if (!runId) throw new Error("runId is required");
  const safeDbPath = ensureSafeDbPath(dbPath);
  const run = {
    run_id: runId,
    started_at: nowIso(),
    finished_at: null,
    git_sha: gitSha,
    suite,
    tier,
    browser,
    project,
    status: "RUNNING",
    command,
  };
  const scenarios = new Map();
  const events = [];
  const violations = [];
  let flushedEvents = 0;
  let flushedViolations = 0;

  function flush({ runTraps = false } = {}) {
    const payload = {
      dbPath: safeDbPath,
      runs: [run],
      scenarios: [...scenarios.values()],
      events: events.slice(flushedEvents),
      violations: violations.slice(flushedViolations),
      runTraps,
    };
    const result = runPythonSqlite(payload);
    flushedEvents = events.length;
    flushedViolations = violations.length;
    return result;
  }

  function startScenario(input) {
    const scenario = {
      scenario_id: input.scenario_id ?? input.id,
      run_id: run.run_id,
      variant_id: input.variant_id ?? input.variantId ?? input.variant?.id,
      mode: input.mode,
      seed: input.seed ?? null,
      viewport: input.viewport ?? input.viewportId ?? input.viewport?.id ?? null,
      viewport_width: input.viewport_width ?? input.viewport?.width ?? null,
      viewport_height: input.viewport_height ?? input.viewport?.height ?? null,
      status: "RUNNING",
      hands_attempted: 0,
      hands_completed: 0,
      actions_observed: 0,
      first_failure_type: null,
      error_message: null,
      started_at: nowIso(),
      finished_at: null,
    };
    scenarios.set(scenario.scenario_id, scenario);
    flush();
    return scenario;
  }

  function recordEvent(scenarioId, row, { action = null, includeSnapshot = false } = {}) {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Unknown soak scenario: ${scenarioId}`);
    const event = normalizeGameplayEvent({
      run,
      scenario,
      row,
      action,
      includeSnapshot,
      eventSeq: events.filter((item) => item.scenario_id === scenarioId).length + 1,
    });
    events.push(event);
    scenario.actions_observed += action ? 1 : 0;
    return event;
  }

  function recordViolation(scenarioId, row, violation, { eventSeq = null, includeSnapshot = false } = {}) {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Unknown soak scenario: ${scenarioId}`);
    const item = normalizeInvariantViolation({ run, scenario, eventSeq, row, violation, includeSnapshot });
    violations.push(item);
    if (!scenario.first_failure_type) scenario.first_failure_type = item.invariant;
    return item;
  }

  function finishScenario(scenarioId, patch = {}) {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Unknown soak scenario: ${scenarioId}`);
    Object.assign(scenario, patch, {
      status: patch.status ?? scenario.status,
      finished_at: nowIso(),
    });
    return flush();
  }

  function finishRun({ status = "PASS", runTraps = true } = {}) {
    run.status = status;
    run.finished_at = nowIso();
    return flush({ runTraps });
  }

  const initial = flush();
  return {
    dbPath: safeDbPath,
    run,
    startScenario,
    recordEvent,
    recordViolation,
    finishScenario,
    finishRun,
    flush,
    initial,
  };
}

export function querySoakSqlite(dbPath, sql) {
  const safeDbPath = ensureSafeDbPath(dbPath);
  return runPythonSqlite({
    dbPath: safeDbPath,
    runTraps: false,
    query: sql,
  });
}
