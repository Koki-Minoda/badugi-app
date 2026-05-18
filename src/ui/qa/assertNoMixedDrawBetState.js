function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

export function assertNoMixedDrawBetState(row = {}) {
  const violations = [];
  const phase = normalizePhase(row.phase);
  const ui = row.ui ?? {};
  const visibleActions = Array.isArray(ui.visibleActions) ? ui.visibleActions : [];
  const drawControlsVisible = Boolean(ui.drawControlsVisible ?? visibleActions.includes("action-draw-selected"));
  const bettingControlsVisible = Boolean(
    ui.bettingControlsVisible ??
      visibleActions.some((action) => ["action-check", "action-call", "action-raise", "action-fold"].includes(action)),
  );
  const currentBet = Number(row.controller?.currentBet ?? 0) || 0;

  if (phase === "BET" && drawControlsVisible) {
    violations.push(
      issue("DRAW_BET_MIXED_STATE", "P0", "BET phase exposes draw controls", {
        phase,
        visibleActions,
      }),
    );
  }

  if (phase === "DRAW" && bettingControlsVisible) {
    violations.push(
      issue("DRAW_BET_MIXED_STATE", "P0", "DRAW phase exposes betting controls", {
        phase,
        visibleActions,
      }),
    );
  }

  if (phase === "DRAW" && currentBet > 0 && visibleActions.includes("action-raise")) {
    violations.push(
      issue("DRAW_BET_MIXED_STATE", "P0", "DRAW phase exposes raise path with unresolved currentBet", {
        currentBet,
        visibleActions,
      }),
    );
  }

  return {
    status: violations.length ? "FAIL" : "PASS",
    violations,
  };
}

export default assertNoMixedDrawBetState;
