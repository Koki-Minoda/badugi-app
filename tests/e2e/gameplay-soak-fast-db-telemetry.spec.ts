import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createGameplaySoakHarness } from "./helpers/gameplaySoakHarness";
import { querySoakSqlite } from "../../src/ui/qa/gameplaySoak/sqliteTelemetry.js";

test("fast soak writes lightweight SQLite telemetry without passing failure artifacts", async ({ page }) => {
  const runLabel = `playwright-fast-db-${Date.now()}`;
  const harness = createGameplaySoakHarness({
    suite: "gameplay-soak-fast-db",
    tier: "fast",
    runLabel,
  });
  const scenario = harness.startScenario({
    id: "fast-db-badugi-cash-seed-101",
    variant: { id: "badugi" },
    mode: "cash",
    seed: 101,
    viewport: { id: "desktop-1280x720", width: 1280, height: 720 },
  });
  await harness.attachRecorders(page, scenario);
  await page.setContent("<main data-testid=\"soak-stub\">soak telemetry stub</main>");
  await page.evaluate(() => {
    window.__MGX_GET_GAMEPLAY_SNAPSHOT__ = ({ label, mode, action }) => ({
      timestamp: Date.now(),
      variantId: "badugi",
      mode,
      handId: "stub-hand-1",
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
      action,
      label,
    });
  });

  const collected = await harness.collect(page, scenario, "initial", { clickedAction: "controller:call" });
  expect(collected.assertion.status).toBe("PASS");
  const scenarioResult = await harness.finishScenario(page, scenario, {
    status: "PASS",
    hands_attempted: 1,
    hands_completed: 1,
    actions_observed: 1,
  });
  expect(scenarioResult.status).toBe("PASS");
  const result = harness.finishRun("PASS");

  expect(fs.existsSync(result.sqlitePath)).toBe(true);
  expect(fs.existsSync(path.join(result.runContext.runDir, "summary.json"))).toBe(true);
  expect(fs.existsSync(path.join(result.runContext.runDir, scenario.scenario.id))).toBe(false);

  const counts = querySoakSqlite(
    result.sqlitePath,
    "SELECT (SELECT COUNT(*) FROM soak_runs) AS runs, (SELECT COUNT(*) FROM soak_scenarios) AS scenarios, (SELECT COUNT(*) FROM gameplay_events) AS events, (SELECT COUNT(*) FROM invariant_violations) AS violations",
  ).rows[0];
  expect(counts).toEqual({ runs: 1, scenarios: 1, events: 1, violations: 0 });

  const sample = querySoakSqlite(
    result.sqlitePath,
    "SELECT variant_id, mode, seed, phase, actor_seat, action, snapshot_json FROM gameplay_events LIMIT 1",
  ).rows[0];
  expect(sample).toMatchObject({
    variant_id: "badugi",
    mode: "cash",
    seed: 101,
    phase: "BET",
    actor_seat: 1,
    action: "controller:call",
    snapshot_json: null,
  });
});
