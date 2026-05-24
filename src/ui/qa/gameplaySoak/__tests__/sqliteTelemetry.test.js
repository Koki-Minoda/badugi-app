import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSoakSqliteTelemetry, querySoakSqlite } from "../sqliteTelemetry.js";

const TEST_RUN_DIR = path.resolve("reports/soak/unit-sqlite-telemetry");
const DB_PATH = path.join(TEST_RUN_DIR, "soak.sqlite");

function removeTestDb() {
  fs.rmSync(TEST_RUN_DIR, { recursive: true, force: true });
}

function buildSnapshot(overrides = {}) {
  return {
    timestamp: 1710000000000,
    variantId: "badugi",
    mode: "cash",
    handId: "hand-1",
    actionIndex: 1,
    phase: "BET",
    drawRound: 0,
    betRound: 1,
    controller: {
      actorSeat: 1,
      nextTurn: 1,
      currentBet: 20,
      pot: 30,
      players: [
        { stack: 490, hand: ["AC", "2D", "3H", "4S"], lastAction: null },
        { stack: 480, hand: ["5C", "6D", "7H", "8S"], folded: false, lastAction: null },
      ],
    },
    ui: {
      heroSeat: 0,
      heroControlsVisible: false,
      bettingControlsVisible: false,
      drawControlsVisible: false,
      displayedPhase: "BET R1",
      visibleActions: [],
    },
    ...overrides,
  };
}

describe("soak sqlite telemetry", () => {
  afterEach(() => {
    removeTestDb();
  });

  it("creates schema and stores lightweight run/scenario/event rows without full snapshots by default", () => {
    removeTestDb();
    const telemetry = createSoakSqliteTelemetry({
      dbPath: DB_PATH,
      runId: "unit-run",
      suite: "unit-soak",
      tier: "fast",
    });
    const scenario = telemetry.startScenario({
      id: "unit-badugi-cash",
      variant_id: "badugi",
      mode: "cash",
      seed: 101,
      viewport: "desktop-1280x720",
    });

    telemetry.recordEvent(scenario.scenario_id, buildSnapshot(), {
      action: { clickedAction: "controller:call" },
    });
    const result = telemetry.finishRun({ status: "PASS", runTraps: true });

    expect(fs.existsSync(DB_PATH)).toBe(true);
    expect(result.counts).toMatchObject({
      soak_runs: 1,
      soak_scenarios: 1,
      gameplay_events: 1,
      invariant_violations: 0,
    });
    expect(result.traps.every((trap) => trap.matched_count === 0)).toBe(true);

    const rows = querySoakSqlite(
      DB_PATH,
      "SELECT run_id, scenario_id, variant_id, phase, actor_seat, action, snapshot_json FROM gameplay_events",
    ).rows;
    expect(rows).toEqual([
      {
        run_id: "unit-run",
        scenario_id: "unit-badugi-cash",
        variant_id: "badugi",
        phase: "BET",
        actor_seat: 1,
        action: "controller:call",
        snapshot_json: null,
      },
    ]);
  });

  it("stores failure snapshots only when requested and surfaces SQL traps", () => {
    removeTestDb();
    const telemetry = createSoakSqliteTelemetry({
      dbPath: DB_PATH,
      runId: "unit-run-fail",
      suite: "unit-soak",
      tier: "fast",
    });
    const scenario = telemetry.startScenario({
      id: "unit-badugi-failure",
      variant_id: "badugi",
      mode: "cash",
      seed: 127,
      viewport: "desktop-1280x720",
    });
    const badSnapshot = buildSnapshot({
      controller: {
        actorSeat: 1,
        nextTurn: 1,
        currentBet: 20,
        pot: -1,
        players: [
          { stack: 490, hand: ["AC", "2D", "3H", "4S", "5C"], lastAction: null },
          { stack: 480, hand: ["5C", "6D", "7H", "8S"], folded: true, lastAction: "Fold" },
        ],
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: true,
        bettingControlsVisible: false,
        drawControlsVisible: true,
        displayedPhase: "BET R1",
        visibleActions: ["action-draw-selected"],
      },
    });
    const event = telemetry.recordEvent(scenario.scenario_id, badSnapshot, {
      action: { clickedAction: "action-draw-selected" },
      includeSnapshot: true,
    });
    telemetry.recordEvent(scenario.scenario_id, { ...badSnapshot, actionIndex: 2 }, {
      action: { clickedAction: "action-draw-selected" },
      includeSnapshot: true,
    });
    telemetry.recordViolation(
      scenario.scenario_id,
      badSnapshot,
      { severity: "P0", type: "ACTOR", message: "controller selected folded actor" },
      { eventSeq: event.event_seq, includeSnapshot: true },
    );
    telemetry.finishScenario(scenario.scenario_id, { status: "FAIL", first_failure_type: "ACTOR" });
    const result = telemetry.finishRun({ status: "FAIL", runTraps: true });

    const matched = Object.fromEntries(result.traps.map((trap) => [trap.trap, trap.matched_count]));
    expect(matched.actor_ineligible).toBeGreaterThan(0);
    expect(matched.hero_controls_visible_not_actor).toBeGreaterThan(0);
    expect(matched.bet_phase_draw_controls).toBeGreaterThan(0);
    expect(matched.badugi_card_count).toBeGreaterThan(0);
    expect(matched.negative_pot).toBeGreaterThan(0);

    const rows = querySoakSqlite(
      DB_PATH,
      "SELECT snapshot_json FROM gameplay_events WHERE scenario_id = 'unit-badugi-failure'",
    ).rows;
    expect(rows[0].snapshot_json).toContain('"variantId":"badugi"');
    expect(result.counts.invariant_violations).toBe(1);
  });

  it("surfaces action index and mobile viewport traps from lightweight event rows", () => {
    removeTestDb();
    const telemetry = createSoakSqliteTelemetry({
      dbPath: DB_PATH,
      runId: "unit-run-mobile",
      suite: "unit-soak",
      tier: "fast",
    });
    const scenario = telemetry.startScenario({
      id: "unit-d01-mobile",
      variant_id: "D01",
      mode: "cash",
      seed: 151,
      viewport: "portrait-390x844",
      viewport_width: 390,
      viewport_height: 844,
    });
    const base = buildSnapshot({
      variantId: "D01",
      actionIndex: 3,
      controller: {
        actorSeat: 0,
        nextTurn: 0,
        currentBet: 20,
        pot: 30,
        players: [
          { stack: 490, hand: ["AC", "2D", "3H", "4S", "5C"], lastAction: null },
          { stack: 480, hand: ["6C", "7D", "8H", "9S", "TC"], folded: false, lastAction: null },
        ],
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: true,
        bettingControlsVisible: true,
        drawControlsVisible: false,
        displayedPhase: "BET R1",
        visibleActions: ["action-fold", "action-call", "action-raise"],
        horizontalOverflow: 0,
        actionBoxes: [
          { testId: "action-fold", x: 10, y: 790, width: 110, height: 46, right: 120, bottom: 836 },
        ],
      },
    });
    telemetry.recordEvent(scenario.scenario_id, base);
    telemetry.recordEvent(scenario.scenario_id, {
      ...base,
      actionIndex: 2,
      ui: {
        ...base.ui,
        horizontalOverflow: 9,
        actionBoxes: [
          { testId: "action-raise", x: 300, y: 820, width: 120, height: 46, right: 420, bottom: 866 },
        ],
      },
    });
    const result = telemetry.finishRun({ status: "FAIL", runTraps: true });
    const matched = Object.fromEntries(result.traps.map((trap) => [trap.trap, trap.matched_count]));
    expect(matched.action_index_regression).toBeGreaterThan(0);
    expect(matched.mobile_horizontal_overflow).toBeGreaterThan(0);
    expect(matched.mobile_action_outside_viewport).toBeGreaterThan(0);
  });

  it("does not trap terminal no-actor control rows as actionable mismatches", () => {
    removeTestDb();
    const telemetry = createSoakSqliteTelemetry({
      dbPath: DB_PATH,
      runId: "unit-run-terminal",
      suite: "unit-soak",
      tier: "fast",
    });
    const scenario = telemetry.startScenario({
      id: "unit-d01-terminal",
      variant_id: "D01",
      mode: "tournament",
      seed: 101,
      viewport: "desktop-1280x720",
    });

    telemetry.recordEvent(scenario.scenario_id, buildSnapshot({
      variantId: "D01",
      phase: "TOURNAMENT_COMPLETE",
      controller: {
        actorSeat: null,
        nextTurn: null,
        currentBet: 0,
        pot: 30,
        players: [
          { stack: 530, hand: ["AC", "2D", "3H", "4S", "5C"], lastAction: "Collect" },
          { stack: 470, hand: ["6C", "7D", "8H", "9S", "TC"], folded: true, lastAction: "Fold" },
        ],
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: true,
        bettingControlsVisible: true,
        drawControlsVisible: true,
        displayedPhase: "Tournament Complete",
        visibleActions: ["action-fold", "action-draw-selected"],
        resultVisible: true,
      },
    }));
    const result = telemetry.finishRun({ status: "PASS", runTraps: true });
    const matched = Object.fromEntries(result.traps.map((trap) => [trap.trap, trap.matched_count]));

    expect(matched.hero_controls_visible_not_actor).toBe(0);
    expect(matched.draw_phase_bet_controls).toBe(0);
    expect(matched.bet_phase_draw_controls).toBe(0);
    expect(matched.same_actor_phase_repeat).toBe(0);
  });
});
