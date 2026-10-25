import { recordBrowserGameplayTrace } from "./browserGameplayTrace.js";
import { appendSnapshotMergeSourceTrace } from "./traceSnapshotMergeSource.js";
import { buildBlindPostingAudit } from "./blindPostingAudit.js";
import { assertNoCrossVariantStateLeak } from "./assertNoCrossVariantStateLeak.js";

function numberOrNull(value) {
  if (value == null || value === "") return null;
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

function hasHiddenAncestor(element) {
  let current = element;
  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0 ||
      style.pointerEvents === "none"
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function isInteractableTestId(testId) {
  if (typeof document === "undefined") return false;
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element || !visibleTestId(testId) || hasHiddenAncestor(element)) return false;
  if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;
  const box = element.getBoundingClientRect();
  const x = Math.min(Math.max(box.left + box.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(box.top + box.height / 2, 0), window.innerHeight - 1);
  if (box.bottom <= 0 || box.right <= 0 || box.left >= window.innerWidth || box.top >= window.innerHeight) {
    return false;
  }
  const topElement = document.elementFromPoint(x, y);
  return Boolean(topElement && (element === topElement || element.contains(topElement)));
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
  ].filter((testId) => isInteractableTestId(testId));
}

function hasInteractableAny(testIds = []) {
  return testIds.some((testId) => isInteractableTestId(testId));
}

function parseDisplayedPot(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function sumPotAmounts(pots = []) {
  if (!Array.isArray(pots)) return 0;
  return pots.reduce((sum, pot) => sum + (Number(pot?.amount ?? pot?.potAmount ?? 0) || 0), 0);
}

function deriveControllerPot({ snapshot, state, phaseState, terminal }) {
  const resultPot = deriveResultPot(snapshot, phaseState);
  if (terminal && resultPot !== null) return resultPot;

  // App's live pot total includes committed street chips. A controller's
  // settled pot may remain unchanged until the next street or even hand.
  const statePot = state?.potTotal != null || state?.totalPot != null
    ? numberOrNull(state?.potTotal ?? state?.totalPot)
    : null;
  if (statePot !== null) return statePot;

  const explicitPot = numberOrNull(snapshot?.pot);
  if (explicitPot && explicitPot > 0) return explicitPot;

  const potsTotal = sumPotAmounts(snapshot?.pots);
  if (potsTotal > 0) return potsTotal;

  const phasePot = numberOrNull(phaseState?.pot ?? phaseState?.potTotal ?? phaseState?.totalPot);
  if (phasePot && phasePot > 0) return phasePot;

  return explicitPot ?? statePot ?? phasePot ?? resultPot ?? 0;
}

function deriveResultPot(snapshot, phaseState) {
  return numberOrNull(phaseState?.resultPot ?? snapshot?.lastHandResult?.pot ?? snapshot?.lastHandResult?.totalPot);
}

function collectControllerSnapshot() {
  const api = window.__BADUGI_E2E__;
  const state = api?.getStateSnapshot?.() ?? null;
  const phaseState = api?.getPhaseState?.() ?? null;
  const snapshot = state?.controllerSnapshot ?? null;
  const variantId = state?.gameVariant ?? snapshot?.variantId ?? null;
  const players = snapshot?.players ?? phaseState?.players ?? state?.players ?? [];
  const rawPhase = normalizePhase(snapshot?.phase ?? snapshot?.street ?? phaseState?.phase ?? state?.phase);
  const resultVisible =
    visibleTestId("hand-result-pot") ||
    (typeof document !== "undefined" && /Hand Result|ハンドの結果/i.test(document.body?.textContent ?? ""));
  const nextHandVisible =
    typeof document !== "undefined" &&
    [...document.querySelectorAll("button")].some((button) => /next hand|次のハンド/i.test(button.textContent ?? ""));
  // The result overlay already makes the actor terminal below. Report its
  // phase consistently too: legacy tournament seating can prepare BET behind
  // that overlay. The unmodified sources remain available in mergeSource.
  const phase = resultVisible || nextHandVisible ? "HAND_RESULT" : rawPhase;
  const terminal =
    resultVisible ||
    nextHandVisible ||
    ["HAND_RESULT", "SHOWDOWN", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].includes(phase);
  const actorSeat =
    terminal
      ? null
      : typeof snapshot?.currentActor === "number"
      ? snapshot.currentActor
      : typeof snapshot?.turn === "number"
        ? snapshot.turn
        : typeof snapshot?.nextTurn === "number"
          ? snapshot.nextTurn
          : typeof phaseState?.turn === "number"
            ? phaseState.turn
            : typeof state?.turn === "number"
              ? state.turn
              : null;
  const nextTurn =
    terminal ? null : typeof snapshot?.nextTurn === "number" ? snapshot.nextTurn : actorSeat;
  const maxExplicitStreetBet = Math.max(
    0,
    ...players.map((player) => Number(player?.betThisStreet ?? player?.committedThisStreet ?? 0) || 0),
  );
  const maxFallbackBet = Math.max(
    0,
    ...players.map((player) => Number(player?.betThisRound ?? player?.bet ?? 0) || 0),
  );
  const effectiveCurrentBet = Math.max(
    numberOrNull(snapshot?.currentBet ?? phaseState?.currentBet ?? state?.currentBet) ?? 0,
    maxExplicitStreetBet > 0 ? maxExplicitStreetBet : String(variantId ?? "").toLowerCase() !== "badugi" ? maxFallbackBet : 0,
  );

  const pot = deriveControllerPot({ snapshot, state, phaseState, terminal });

  return {
    rawState: state,
    phaseState,
    snapshot,
    players,
    handId: state?.handId ?? phaseState?.handId ?? snapshot?.handId ?? null,
    variantId,
    mode: document?.body?.dataset?.mode ?? null,
    phase,
    terminal,
    drawRound: numberOrNull(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? phaseState?.drawRound ?? state?.drawRound),
    betRound: numberOrNull(phaseState?.betRound ?? state?.betRound ?? snapshot?.betRound ?? snapshot?.betRoundIndex),
    actionIndex: numberOrNull(snapshot?.actionIndex ?? state?.actionIndex),
    buttonSeat: numberOrNull(
      snapshot?.dealerIndex ??
        snapshot?.dealerIdx ??
        snapshot?.dealerSeat ??
        state?.dealerIdx ??
        phaseState?.dealerIdx,
    ),
    sbSeat: numberOrNull(
      snapshot?.smallBlindSeat ??
        snapshot?.sbSeat ??
        snapshot?.smallBlindIndex ??
        snapshot?.metadata?.lastBlinds?.sbIndex,
    ),
    bbSeat: numberOrNull(
      snapshot?.bigBlindSeat ??
        snapshot?.bbSeat ??
        snapshot?.bigBlindIndex ??
        snapshot?.metadata?.lastBlinds?.bbIndex,
    ),
    actorSeat,
    nextTurn,
    currentBet: effectiveCurrentBet,
    pot,
    resultPot: terminal ? deriveResultPot(snapshot, phaseState) : null,
  };
}

function collectUiSnapshot(controller) {
  const visibleActions = visibleActionIds();
  // At the result screen the table prepares the next hand and resets its
  // background pot. The overlay is the pot the player can actually read.
  const resultVisible = visibleTestId("hand-result-pot") ||
    (typeof document !== "undefined" && /Hand Result|ハンドの結果/i.test(document.body?.textContent ?? ""));
  const displayedPotText = visibleTestId("hand-result-total")
    ? textForTestId("hand-result-total")
    : textForTestId("table-total-pot");
  return {
    actingBadgeSeat: null,
    heroControlsVisible: visibleActions.length > 0,
    heroSeat: 0,
    displayedPot: parseDisplayedPot(displayedPotText),
    displayedPotText,
    displayedPhase: normalizePhase(textForTestId("table-phase-badge")) ?? controller.phase,
    visibleActions,
    bettingControlsVisible: hasInteractableAny(["action-check", "action-call", "action-raise", "action-fold"]),
    drawControlsVisible: hasInteractableAny(["action-draw-selected"]),
    resultVisible,
    nextHandVisible:
      typeof document !== "undefined" &&
      [...document.querySelectorAll("button")].some((button) => /next hand|次のハンド/i.test(button.textContent ?? "")),
  };
}

export function collectBrowserGameplaySnapshot(extra = {}) {
  if (typeof window === "undefined") return null;
  const controller = collectControllerSnapshot();
  const ui = collectUiSnapshot(controller);
  const mergeSource = appendSnapshotMergeSourceTrace(extra);
  const controllerDebug = window.__BADUGI_E2E__?.getControllerDebug?.() ?? null;
  const blindPosting = buildBlindPostingAudit({
    snapshot: {
      ...(controller.snapshot ?? {}),
      buttonSeat: controller.buttonSeat,
      sbSeat: controller.sbSeat,
      bbSeat: controller.bbSeat,
      currentBet: controller.currentBet,
      pot: controller.pot,
    },
    players: controller.players,
    heroSeat: 0,
    displayedPot: ui.displayedPot,
  });
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
      legacyTurn: controller.phaseState?.turn ?? controller.rawState?.turn ?? null,
      currentBet: controller.currentBet,
      pot: controller.pot,
      resultPot: controller.resultPot,
      players: controller.players,
    },
    ui,
    blindPosting,
    mergeSource,
    controllerDebug,
    action: extra.action ?? null,
    label: extra.label ?? null,
  };
  row.crossVariant = assertNoCrossVariantStateLeak({
    currentVariant: row.variantId,
    controllerClass: controllerDebug?.gameControllerName,
    controllerVariantRef: controllerDebug?.controllerVariantRef,
    gameControllerVariantId: controllerDebug?.gameControllerVariantId,
    sessionVariantId: controllerDebug?.sessionVariantId,
    controllerSnapshotVariantId: controller.snapshot?.variantId ?? controller.snapshot?.gameVariant ?? null,
    engineStateVariantId: controller.rawState?.engineStateVariantId ?? controller.rawState?.gameVariant ?? null,
    handId: row.handId,
    snapshot: controller.snapshot,
    players: controller.players,
  });
  recordBrowserGameplayTrace(row);
  return row;
}
