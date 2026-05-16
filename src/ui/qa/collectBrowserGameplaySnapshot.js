import { recordBrowserGameplayTrace } from "./browserGameplayTrace.js";

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

function visibleTestId(testId) {
  if (typeof document === "undefined") return false;
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element) return false;
  const box = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function textForTestId(testId) {
  if (typeof document === "undefined") return null;
  return document.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? null;
}

function visibleActionIds() {
  if (typeof document === "undefined") return [];
  return [
    "action-check",
    "action-call",
    "action-raise",
    "action-fold",
    "action-draw-selected",
  ].filter((testId) => visibleTestId(testId));
}

function parseDisplayedPot(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function collectControllerSnapshot() {
  const api = window.__BADUGI_E2E__;
  const state = api?.getStateSnapshot?.() ?? null;
  const phaseState = api?.getPhaseState?.() ?? null;
  const snapshot = state?.controllerSnapshot ?? null;
  const players = phaseState?.players ?? snapshot?.players ?? state?.players ?? [];
  const phase = normalizePhase(phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase);
  const actorSeat =
    typeof phaseState?.turn === "number"
      ? phaseState.turn
      : typeof snapshot?.currentActor === "number"
        ? snapshot.currentActor
        : typeof snapshot?.turn === "number"
          ? snapshot.turn
          : typeof state?.turn === "number"
            ? state.turn
            : null;

  return {
    rawState: state,
    phaseState,
    snapshot,
    players,
    handId: phaseState?.handId ?? state?.handId ?? null,
    variantId: state?.gameVariant ?? snapshot?.variantId ?? null,
    mode: document?.body?.dataset?.mode ?? null,
    phase,
    drawRound: numberOrNull(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? phaseState?.drawRound ?? state?.drawRound),
    betRound: numberOrNull(phaseState?.betRound ?? state?.betRound ?? snapshot?.betRound ?? snapshot?.betRoundIndex),
    actionIndex: numberOrNull(snapshot?.actionIndex ?? state?.actionIndex),
    buttonSeat: numberOrNull(snapshot?.dealerIndex ?? state?.dealerIdx ?? phaseState?.dealerIdx),
    sbSeat: numberOrNull(snapshot?.smallBlindSeat ?? snapshot?.sbSeat),
    bbSeat: numberOrNull(snapshot?.bigBlindSeat ?? snapshot?.bbSeat),
    actorSeat,
    nextTurn: typeof snapshot?.nextTurn === "number" ? snapshot.nextTurn : actorSeat,
    currentBet: numberOrNull(snapshot?.currentBet ?? phaseState?.currentBet ?? state?.currentBet) ?? 0,
    pot: numberOrNull(snapshot?.pot ?? state?.potTotal) ?? 0,
  };
}

function collectUiSnapshot(controller) {
  const visibleActions = visibleActionIds();
  const displayedPotText = textForTestId("table-total-pot");
  return {
    actingBadgeSeat: null,
    heroControlsVisible: visibleActions.length > 0,
    heroSeat: 0,
    displayedPot: parseDisplayedPot(displayedPotText),
    displayedPotText,
    displayedPhase: normalizePhase(textForTestId("table-phase-badge")) ?? controller.phase,
    visibleActions,
    resultVisible:
      visibleTestId("hand-result-pot") ||
      (typeof document !== "undefined" && /Hand Result/i.test(document.body?.textContent ?? "")),
    nextHandVisible:
      typeof document !== "undefined" &&
      [...document.querySelectorAll("button")].some((button) => /next hand/i.test(button.textContent ?? "")),
  };
}

export function collectBrowserGameplaySnapshot(extra = {}) {
  if (typeof window === "undefined") return null;
  const controller = collectControllerSnapshot();
  const ui = collectUiSnapshot(controller);
  const row = {
    timestamp: Date.now(),
    variantId: controller.variantId,
    mode: extra.mode ?? controller.mode,
    handId: controller.handId,
    actionIndex: controller.actionIndex,
    phase: controller.phase,
    drawRound: controller.drawRound,
    betRound: controller.betRound,
    buttonSeat: controller.buttonSeat,
    sbSeat: controller.sbSeat,
    bbSeat: controller.bbSeat,
    controller: {
      actorSeat: controller.actorSeat,
      nextTurn: controller.nextTurn,
      currentBet: controller.currentBet,
      pot: controller.pot,
      players: controller.players,
    },
    ui,
    action: extra.action ?? null,
    label: extra.label ?? null,
  };
  recordBrowserGameplayTrace(row);
  return row;
}

