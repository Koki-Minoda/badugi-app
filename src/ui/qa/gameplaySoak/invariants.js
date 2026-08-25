import { assertBrowserGameplayInvariants } from "../assertBrowserGameplayInvariants.js";

function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

function isTerminalPhase(phase) {
  return [
    "HAND_RESULT",
    "HAND_COMPLETE",
    "SHOWDOWN",
    "WAITING_NEXT_HAND",
    "TABLE_FINISHED",
    "TOURNAMENT_COMPLETE",
    "COMPLETE",
    "TERMINAL",
  ].includes(normalizePhase(phase));
}

function isActionablePhase(phase) {
  return ["BET", "DRAW"].includes(normalizePhase(phase));
}

function actorSeat(row) {
  return row?.controller?.actorSeat ?? null;
}

function isActionableSnapshot(row) {
  return isActionablePhase(row?.phase) && typeof actorSeat(row) === "number" && !isTerminalPhase(row?.phase);
}

function isControlMismatch(violation) {
  return [
    "ACTION_REOPEN",
    "BET_CONTROLS",
    "DRAW_CONTROLS",
    "PHASE_BADGE",
    "PHASE",
    "STALE_PHASE_MERGE",
    "UI_CONTROLLER_DIVERGENCE",
  ].includes(String(violation?.type ?? violation?.invariant ?? ""));
}

function isActorMismatch(violation) {
  return ["ACTOR", "BETTING_CLOSURE"].includes(String(violation?.type ?? violation?.invariant ?? ""));
}

export function classifySoakViolation(row, violation) {
  const type = String(violation?.type ?? violation?.invariant ?? "");
  if (type === "FREEZE") return "true_freeze";
  if (isTerminalPhase(row?.phase) || (actorSeat(row) == null && row?.ui?.resultVisible)) return "terminal_state";
  if (!isActionableSnapshot(row)) return "transient_transition";
  if (isActorMismatch(violation)) return "actor_mismatch";
  if (isControlMismatch(violation)) return "control_mismatch";
  return "true_freeze";
}

function annotateViolation(row, violation, patch = {}) {
  return {
    ...violation,
    ...patch,
    classification: patch.classification ?? violation?.classification ?? classifySoakViolation(row, violation),
  };
}

export function applySoakViolationStability(row, violations = [], stability = {}, options = {}) {
  const mismatchThreshold = Math.max(1, Number(options.controlMismatchThreshold ?? options.mismatchThreshold ?? 2));
  const stable = stability;
  stable.mismatchStreaks ??= new Map();
  stable.lastMismatchKeys ??= new Set();
  const currentMismatchKeys = new Set();

  const nextViolations = violations.map((violation) => {
    const classification = classifySoakViolation(row, violation);

    if (classification === "terminal_state" || classification === "transient_transition") {
      return annotateViolation(row, violation, {
        severity: violation?.severity === "P0" ? "P1" : violation?.severity,
        classification,
      });
    }

    if (classification === "control_mismatch" || classification === "actor_mismatch") {
      const key = [
        violation?.type ?? violation?.invariant ?? "control",
        row?.handId ?? "unknown-hand",
        normalizePhase(row?.phase) ?? "unknown-phase",
        actorSeat(row) ?? "no-actor",
      ].join(":");
      currentMismatchKeys.add(key);
      const nextCount = stable.lastMismatchKeys.has(key) ? (stable.mismatchStreaks.get(key) ?? 0) + 1 : 1;
      stable.mismatchStreaks.set(key, nextCount);
      if (nextCount < mismatchThreshold) {
        return annotateViolation(row, violation, {
          severity: violation?.severity === "P0" ? "P1" : violation?.severity,
          classification,
          transientCount: nextCount,
          transientThreshold: mismatchThreshold,
        });
      }
      return annotateViolation(row, violation, {
        classification,
        transientCount: nextCount,
        transientThreshold: mismatchThreshold,
      });
    }

    return annotateViolation(row, violation, { classification });
  });

  for (const key of [...stable.mismatchStreaks.keys()]) {
    if (!currentMismatchKeys.has(key)) stable.mismatchStreaks.delete(key);
  }
  stable.lastMismatchKeys = currentMismatchKeys;
  return nextViolations;
}

export function compactTraceRow(row, assertion, scenario) {
  if (scenario?.traceMode === "normal" || assertion.violations.length > 0 || ["initial", "terminal"].includes(String(row?.label ?? ""))) {
    return row;
  }
  return {
    timestamp: row.timestamp,
    variantId: row.variantId,
    mode: row.mode,
    handId: row.handId,
    actionIndex: row.actionIndex,
    phase: row.phase,
    drawRound: row.drawRound,
    betRound: row.betRound,
    controller: {
      actorSeat: row.controller?.actorSeat ?? null,
      nextTurn: row.controller?.nextTurn ?? null,
      currentBet: row.controller?.currentBet ?? null,
      pot: row.controller?.pot ?? null,
      playerCount: row.controller?.players?.length ?? 0,
    },
    ui: {
      heroControlsVisible: row.ui?.heroControlsVisible ?? false,
      visibleActions: row.ui?.visibleActions ?? [],
      displayedPhase: row.ui?.displayedPhase ?? null,
      resultVisible: row.ui?.resultVisible ?? false,
    },
    action: row.action ?? null,
    label: row.label ?? null,
    expected: assertion.expected,
    violations: assertion.violations,
  };
}

export function evaluateSoakSnapshot(row, previousRows = [], scenario = {}) {
  const assertion = assertBrowserGameplayInvariants(row, previousRows);
  const violations = [...assertion.violations];
  const phase = normalizePhase(row?.phase);
  const terminal = isTerminalPhase(phase);
  const players = row?.controller?.players ?? [];
  const variantId = String(row?.variantId ?? scenario?.variant?.id ?? "").toLowerCase();
  const expectedCards = Number(scenario?.variant?.expectedHeroCards ?? (variantId === "badugi" ? 4 : 5));

  for (const [seat, player] of players.entries()) {
    if (!player) continue;
    const stack = Number(player?.stack ?? 0);
    const bet = Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0);
    if (!Number.isFinite(stack) || stack < 0) {
      violations.push(issue("STACK", "P0", "player stack is negative or invalid", { seat, stack }));
    }
    if (!Number.isFinite(bet) || bet < 0) {
      violations.push(issue("BET", "P0", "player bet is negative or invalid", { seat, bet }));
    }
  }

  const pot = Number(row?.controller?.pot ?? 0);
  if (!Number.isFinite(pot) || pot < 0) {
    violations.push(issue("POT", "P0", "controller pot is negative or invalid", { pot }));
  }

  const heroHand = players[0]?.hand;
  if (Array.isArray(heroHand) && heroHand.length > 0 && !terminal && heroHand.length !== expectedCards) {
    violations.push(
      issue("HAND_SHAPE", "P0", "hero hand shape does not match variant layout group", {
        expectedCards,
        actualCards: heroHand.length,
        variantId: row?.variantId ?? scenario?.variant?.id ?? null,
      }),
    );
  }

  const actionIds = new Set(row?.ui?.visibleActions ?? []);
  const actionableSnapshot = isActionableSnapshot(row);
  if (actionableSnapshot && phase === "DRAW" && ["action-check", "action-call", "action-raise", "action-fold"].some((id) => actionIds.has(id))) {
    violations.push(issue("DRAW_CONTROLS", "P0", "betting controls are visible during DRAW", { visibleActions: [...actionIds] }));
  }
  if (actionableSnapshot && phase === "BET" && actionIds.has("action-draw-selected")) {
    violations.push(issue("BET_CONTROLS", "P0", "draw controls are visible during BET", { visibleActions: [...actionIds] }));
  }

  const displayedPhase = normalizePhase(row?.ui?.displayedPhase);
  const displayedPhaseText = String(row?.ui?.displayedPhase ?? "");
  if (actionableSnapshot && phase === "BET" && /DRAW RUSHER/i.test(displayedPhaseText)) {
    violations.push(issue("PHASE_BADGE", "P0", "DRAW RUSHER indicator is visible during BET", { displayedPhase }));
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    expected: assertion.expected,
    violations,
  };
}

export async function evaluateMobileViewport(page) {
  const metrics = await page.evaluate(() => {
    const actionIds = ["action-fold", "action-call", "action-check", "action-raise", "action-draw-selected"];
    const actionBoxes = actionIds
      .map((testId) => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        if (!element) return null;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || box.width <= 0 || box.height <= 0) return null;
        return { testId, x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      })
      .filter(Boolean);
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      actionBoxes,
    };
  });
  const violations = [];
  if (metrics.horizontalOverflow > 2) {
    violations.push(issue("MOBILE_OVERFLOW", "P0", "mobile viewport has horizontal overflow", metrics));
  }
  for (const box of metrics.actionBoxes) {
    if (box.x < -1 || box.y < -1 || box.right > metrics.width + 1 || box.bottom > metrics.height + 1) {
      violations.push(issue("MOBILE_ACTIONS", "P0", "action button is outside viewport", { box, viewport: metrics }));
    }
    if (box.height < 40) {
      violations.push(issue("MOBILE_ACTIONS", "P1", "action button is below target size", { box }));
    }
  }
  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    metrics,
    violations,
  };
}
