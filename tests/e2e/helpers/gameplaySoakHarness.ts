import path from "node:path";
import type { Page } from "@playwright/test";
import {
  applySoakViolationStability,
  classifySoakViolation,
  evaluateMobileViewport,
  evaluateSoakSnapshot,
} from "../../../src/ui/qa/gameplaySoak/invariants.js";
import {
  createSoakRunContext,
  writeSoakFailureArtifacts,
  writeSoakSummary,
} from "../../../src/ui/qa/gameplaySoak/artifacts.js";
import { createSoakSqliteTelemetry } from "../../../src/ui/qa/gameplaySoak/sqliteTelemetry.js";
import {
  getProgressState,
  performSafeAction,
  progressKey,
  waitForProgressChange,
} from "./gameProgressHelper.js";

type SoakScenario = {
  id: string;
  variant?: { id: string; expectedHeroCards?: number; maxSteps?: number };
  variant_id?: string;
  mode: string;
  seed?: number;
  viewport?: { id?: string; width?: number; height?: number } | string;
  policy?: string;
  maxSteps?: number;
  traceMode?: string;
};

type RingEntry = {
  row: unknown;
  assertion: ReturnType<typeof evaluateSoakSnapshot>;
};

const TERMINAL_PHASES = new Set([
  "HAND_RESULT",
  "HAND_COMPLETE",
  "SHOWDOWN",
  "WAITING_NEXT_HAND",
  "TABLE_FINISHED",
  "TOURNAMENT_COMPLETE",
  "COMPLETE",
  "TERMINAL",
]);

function pushRing<T>(ring: T[], item: T, limit: number) {
  ring.push(item);
  if (ring.length > limit) ring.splice(0, ring.length - limit);
}

function scenarioViewportId(scenario: SoakScenario) {
  if (typeof scenario.viewport === "string") return scenario.viewport;
  return scenario.viewport?.id ?? "unknown";
}

function scenarioIsMobile(scenario: SoakScenario) {
  if (typeof scenario.viewport === "string") return /portrait|mobile/i.test(scenario.viewport);
  return Boolean(
    scenario.viewport &&
      (
        /portrait|mobile/i.test(String(scenario.viewport.id ?? "")) ||
        (Number(scenario.viewport.width ?? 9999) < Number(scenario.viewport.height ?? 0) &&
          Number(scenario.viewport.width ?? 9999) <= 480)
      ),
  );
}

function compactUiMetrics(metrics: any) {
  return {
    horizontalOverflow: metrics?.horizontalOverflow ?? null,
    actionBoxes: Array.isArray(metrics?.actionBoxes)
      ? metrics.actionBoxes.map((box: any) => ({
          testId: box.testId,
          x: Math.round(Number(box.x ?? 0)),
          y: Math.round(Number(box.y ?? 0)),
          width: Math.round(Number(box.width ?? 0)),
          height: Math.round(Number(box.height ?? 0)),
          right: Math.round(Number(box.right ?? 0)),
          bottom: Math.round(Number(box.bottom ?? 0)),
        }))
      : [],
  };
}

function combineAssertions(snapshotAssertion: any, extraViolations: any[] = []) {
  const violations = [...(snapshotAssertion?.violations ?? []), ...extraViolations];
  return {
    ...snapshotAssertion,
    status: violations.some((violation) => violation.severity === "P0")
      ? "FAIL"
      : violations.length
        ? "WARN"
        : "PASS",
    violations,
  };
}

function isTerminalProgress(progress: any) {
  const livePlayers = (progress?.players ?? []).filter((player: any) =>
    player &&
      !(player.folded || player.hasFolded) &&
      !(player.seatOut || player.isBusted) &&
      Number(player.stack ?? 0) >= 0,
  );
  return Boolean(
    progress?.isTerminal ||
      TERMINAL_PHASES.has(String(progress?.phase ?? "").toUpperCase()) ||
      (progress?.actor == null && (progress?.ui?.resultVisible || progress?.ui?.nextHandVisible || livePlayers.length <= 1)),
  );
}

function firstFailureClassification(row: any, violation: any, fallback = "true_freeze") {
  if (violation?.classification) return violation.classification;
  if (!violation) return fallback;
  return classifySoakViolation(row, violation);
}

function failureInvariantForMessage(message: unknown) {
  const text = String(message ?? "");
  if (/freeze|same gameplay state/i.test(text)) return "FREEZE";
  if (/No soak action|No safe action|no-actor/i.test(text)) return "NO_ACTION";
  if (/timeout/i.test(text)) return "TIMEOUT";
  return "SCENARIO_FAILURE";
}

function failureClassificationForMessage(message: unknown) {
  const text = String(message ?? "");
  if (/freeze|same gameplay state/i.test(text)) return "true_freeze";
  if (/terminal/i.test(text)) return "terminal_state";
  if (/control/i.test(text)) return "control_mismatch";
  if (/actor/i.test(text)) return "actor_mismatch";
  return "transient_transition";
}

async function clickNextHandIfAvailable(page: Page) {
  const nextHand = page.getByRole("button", { name: /next hand/i }).first();
  if (!(await nextHand.count())) return false;
  if (!(await nextHand.isVisible().catch(() => false))) return false;
  if (!(await nextHand.isEnabled().catch(() => false))) return false;
  await nextHand.click();
  return true;
}

export async function installSoakSeed(page: Page, seed: number | undefined) {
  if (!Number.isFinite(Number(seed))) return;
  await page.addInitScript((seedValue) => {
    let state = Number(seedValue) >>> 0;
    if (!state) state = 1;
    Math.random = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    window.__MGX_SOAK_SEED__ = seedValue;
  }, Number(seed));
}

export function createGameplaySoakHarness({
  suite = "gameplay-soak-fast",
  tier = process.env.SOAK_TIER ?? "fast",
  runLabel = process.env.SOAK_RUN_LABEL,
  ringSize = Number(process.env.SOAK_RING_SIZE ?? 100),
}: {
  suite?: string;
  tier?: string;
  runLabel?: string;
  ringSize?: number;
} = {}) {
  const runContext = createSoakRunContext({ label: runLabel, tier });
  const sqlite = createSoakSqliteTelemetry({
    dbPath: path.join(runContext.runDir, "soak.sqlite"),
    runId: runContext.runId,
    suite,
    tier,
  });
  const summaryRows: any[] = [];

  function startScenario(scenario: SoakScenario) {
    const dbScenario = sqlite.startScenario({
      id: scenario.id,
      variant_id: scenario.variant_id ?? scenario.variant?.id,
      mode: scenario.mode,
      seed: scenario.seed,
      viewport: scenarioViewportId(scenario),
      viewport_width: typeof scenario.viewport === "object" ? scenario.viewport.width : null,
      viewport_height: typeof scenario.viewport === "object" ? scenario.viewport.height : null,
    });
    const eventRing: RingEntry[] = [];
    const consoleRows: any[] = [];
    const networkRows: any[] = [];
    return {
      scenario,
      dbScenario,
      traceRows: [] as any[],
      snapshotRows: [] as any[],
      eventRing,
      recorders: {
        consoleRows,
      networkRows,
      pageErrors: [],
      stability: {},
      fatalConsoleErrors: () => consoleRows.filter((row) => row.type === "error"),
      },
    };
  }

  async function attachRecorders(page: Page, scenarioState: ReturnType<typeof startScenario>) {
    page.on("console", (message) => {
      pushRing(
        scenarioState.recorders.consoleRows,
        { timestamp: Date.now(), type: message.type(), text: message.text() },
        ringSize,
      );
    });
    page.on("pageerror", (error) => {
      pushRing(
        scenarioState.recorders.consoleRows,
        { timestamp: Date.now(), type: "pageerror", text: error.message },
        ringSize,
      );
    });
    page.on("requestfailed", (request) => {
      pushRing(
        scenarioState.recorders.networkRows,
        {
          timestamp: Date.now(),
          type: "requestfailed",
          method: request.method(),
          url: request.url(),
          failure: request.failure()?.errorText ?? null,
        },
        ringSize,
      );
    });
    page.on("response", (response) => {
      if (response.status() < 500) return;
      pushRing(
        scenarioState.recorders.networkRows,
        { timestamp: Date.now(), type: "response", status: response.status(), url: response.url() },
        ringSize,
      );
    });
  }

  async function collect(page: Page, scenarioState: ReturnType<typeof startScenario>, label: string, action: unknown = null) {
    await page.waitForTimeout(Number(process.env.SOAK_SNAPSHOT_SETTLE_MS ?? 80));
    const row = await page.evaluate(
      ({ nextLabel, nextMode, nextAction }) => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({
        label: nextLabel,
        mode: nextMode,
        action: nextAction,
      }),
      { nextLabel: label, nextMode: scenarioState.scenario.mode, nextAction: action },
    );
    if (!row) throw new Error("window.__MGX_GET_GAMEPLAY_SNAPSHOT__ is unavailable");
    if (row.actionIndex == null) {
      row.actionIndex = scenarioState.traceRows.length;
    }
    let mobileViolations: any[] = [];
    if (scenarioIsMobile(scenarioState.scenario)) {
      const mobileAssertion = await evaluateMobileViewport(page);
      row.ui = {
        ...(row.ui ?? {}),
        ...compactUiMetrics(mobileAssertion.metrics),
      };
      mobileViolations = mobileAssertion.violations;
    }
    const rawAssertion = combineAssertions(
      evaluateSoakSnapshot(row, scenarioState.snapshotRows, scenarioState.scenario),
      mobileViolations,
    );
    const stableViolations = applySoakViolationStability(row, rawAssertion.violations, scenarioState.stability, {
      controlMismatchThreshold: Number(process.env.SOAK_TRANSIENT_MISMATCH_THRESHOLD ?? 2),
    });
    const assertion = {
      ...rawAssertion,
      status: stableViolations.some((violation) => violation.severity === "P0")
        ? "FAIL"
        : stableViolations.length
          ? "WARN"
          : "PASS",
      violations: stableViolations,
    };
    const event = sqlite.recordEvent(scenarioState.dbScenario.scenario_id, row, {
      action,
      includeSnapshot: assertion.violations.some((violation) => violation.severity === "P0"),
    });
    for (const violation of assertion.violations.filter((item) => item.severity === "P0")) {
      sqlite.recordViolation(scenarioState.dbScenario.scenario_id, row, violation, {
        eventSeq: event.event_seq,
        includeSnapshot: violation.severity === "P0",
      });
    }
    const traceEntry = {
      eventSeq: event.event_seq,
      label,
      handId: row.handId ?? null,
      phase: row.phase ?? null,
      actorSeat: row.controller?.actorSeat ?? null,
      violations: assertion.violations,
    };
    scenarioState.traceRows.push(traceEntry);
    scenarioState.snapshotRows.push(row);
    if (scenarioState.snapshotRows.length > ringSize) {
      scenarioState.snapshotRows.splice(0, scenarioState.snapshotRows.length - ringSize);
    }
    pushRing(scenarioState.eventRing, { row, assertion }, ringSize);
    return { row, assertion, event };
  }

  async function playProgression(
    page: Page,
    scenarioState: ReturnType<typeof startScenario>,
    {
      minEvents = Number(process.env.SOAK_MIN_EVENTS ?? 10),
      maxEvents = Number(process.env.SOAK_MAX_EVENTS ?? 30),
      maxSteps = Number(scenarioState.scenario.maxSteps ?? scenarioState.scenario.variant?.maxSteps ?? 100),
      autoCpuTimeout = Number(process.env.SOAK_AUTO_CPU_TIMEOUT_MS ?? 20000),
      policy = scenarioState.scenario.policy ?? "safe",
    }: {
      minEvents?: number;
      maxEvents?: number;
      maxSteps?: number;
      autoCpuTimeout?: number;
      policy?: string;
    } = {},
  ) {
    let events = 0;
    let actionsObserved = 0;
    let handsCompleted = 0;
    let lastKey: string | null = null;
    let sameStateCount = 0;

    await collect(page, scenarioState, "initial", null);
    events += 1;

    for (let step = 0; step < maxSteps && events < maxEvents; step += 1) {
      const progress = await getProgressState(page);
      const key = progressKey(progress);
      if (isTerminalProgress(progress)) {
        handsCompleted += 1;
        await collect(page, scenarioState, `terminal-${handsCompleted}`, { clickedAction: "terminal" });
        events += 1;
        if (events >= minEvents) break;
        const clicked = await clickNextHandIfAvailable(page);
        if (!clicked) break;
        await waitForProgressChange(page, key, { timeout: 15000 }).catch(() => {});
        continue;
      }

      sameStateCount = key === lastKey ? sameStateCount + 1 : 0;
      lastKey = key;
      if (sameStateCount > 5) {
        throw new Error(`soak freeze guard: same gameplay state repeated ${sameStateCount + 1} times`);
      }

      const action = await performSafeAction(page, {
        policy,
        autoCpu: true,
        autoCpuTimeout,
      });
      if (!action.acted) {
        if (["terminal", "no-actor"].includes(String(action.reason ?? "")) && isTerminalProgress(action.before ?? progress)) {
          handsCompleted += 1;
          await collect(page, scenarioState, `terminal-${handsCompleted}`, { clickedAction: String(action.reason ?? "terminal") });
          events += 1;
          if (events >= minEvents) break;
          continue;
        }
        throw new Error(`No soak action available: ${JSON.stringify(action)}`);
      }
      actionsObserved += 1;
      await waitForProgressChange(page, key, { timeout: 15000 }).catch(() => {});
      await collect(page, scenarioState, `step-${step + 1}`, action);
      events += 1;
    }

    if (events < minEvents) {
      throw new Error(`soak scenario recorded only ${events} events; expected at least ${minEvents}`);
    }

    return {
      events,
      actionsObserved,
      handsCompleted,
    };
  }

  async function finishScenario(page: Page, scenarioState: ReturnType<typeof startScenario>, patch: Record<string, unknown> = {}) {
    const failed = scenarioState.eventRing.some((entry) =>
      entry.assertion.violations.some((violation) => violation.severity === "P0"),
    );
    const status = failed ? "FAIL" : String(patch.status ?? "PASS");
    const lastSnapshot = scenarioState.eventRing.at(-1)?.row ?? null;
    const firstP0Violation = scenarioState.eventRing
      .flatMap((entry) => entry.assertion.violations)
      .find((violation) => violation.severity === "P0");
    const failureClassification =
      status === "FAIL"
        ? firstFailureClassification(lastSnapshot, firstP0Violation, failureClassificationForMessage(patch.error_message))
        : null;
    let artifactDir: string | null = null;
    if (status === "FAIL") {
      artifactDir = await writeSoakFailureArtifacts({
        page,
        runContext,
        scenario: scenarioState.scenario,
        error: new Error("soak invariant failure"),
        traceRows: scenarioState.traceRows.slice(-ringSize),
        lastSnapshot,
        recorders: scenarioState.recorders,
        classification: failureClassification,
      });
    }
    let firstFailureType = firstP0Violation?.type ?? null;
    if (status === "FAIL" && !firstP0Violation) {
      firstFailureType = failureInvariantForMessage(patch.error_message);
      sqlite.recordViolation(
        scenarioState.dbScenario.scenario_id,
        lastSnapshot,
        {
          severity: "P0",
          type: firstFailureType,
          message: String(patch.error_message ?? "soak scenario failed"),
        },
        {
          eventSeq: scenarioState.traceRows.at(-1)?.eventSeq ?? null,
          includeSnapshot: true,
        },
      );
    }
    sqlite.finishScenario(scenarioState.dbScenario.scenario_id, {
      status,
      hands_attempted: patch.hands_attempted ?? 1,
      hands_completed: patch.hands_completed ?? (status === "PASS" ? 1 : 0),
      actions_observed: patch.actions_observed ?? scenarioState.traceRows.length,
      first_failure_type: patch.first_failure_type ?? firstFailureType,
      error_message: patch.error_message ?? null,
    });
    summaryRows.push({
      scenarioId: scenarioState.dbScenario.scenario_id,
      variantId: scenarioState.dbScenario.variant_id,
      mode: scenarioState.dbScenario.mode,
      seed: scenarioState.dbScenario.seed,
      viewport: scenarioState.dbScenario.viewport,
      status,
      eventCount: scenarioState.traceRows.length,
      artifactDir,
      classification: failureClassification,
    });
    return { status, artifactDir };
  }

  function finishRun(status = summaryRows.some((row) => row.status === "FAIL") ? "FAIL" : "PASS") {
    const sqliteResult = sqlite.finishRun({ status, runTraps: true });
    const summary = writeSoakSummary(runContext, summaryRows);
    return { runContext, sqlitePath: sqlite.dbPath, sqliteResult, summary };
  }

  return {
    runContext,
    sqlite,
    startScenario,
    attachRecorders,
    collect,
    playProgression,
    finishScenario,
    finishRun,
  };
}
