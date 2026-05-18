import { expectedBrowserActor } from "./expectedBrowserActor.js";

const WAITING_TEXT_RE = /Waiting for other players|他のプレイヤー|待機/i;

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

function isFolded(player = {}) {
  return Boolean(
    player.folded ||
      player.hasFolded ||
      String(player.status ?? "").toUpperCase() === "FOLDED",
  );
}

function isSeatOut(player = {}) {
  const status = String(player.status ?? "").toUpperCase();
  return Boolean(
    player.seatOut ||
      player.sittingOut ||
      player.isSittingOut ||
      player.isBusted ||
      player.busted ||
      player.isActiveInGame === false ||
      status === "BUSTED" ||
      status === "OUT",
  );
}

function isAllIn(player = {}) {
  return Boolean(player.allIn || player.isAllIn || String(player.status ?? "").toUpperCase() === "ALL-IN");
}

function playerBet(player = {}) {
  return Number(player.betThisStreet ?? player.betThisRound ?? player.bet ?? player.committedThisStreet ?? 0) || 0;
}

function playerStack(player = {}) {
  return Number(player.stack ?? player.chips ?? 0) || 0;
}

function normalizePlayers(players = []) {
  return players.map((player, seat) => ({
    seat,
    position: player?.position ?? player?.role ?? null,
    name: player?.name ?? `Seat ${seat}`,
    stack: playerStack(player),
    bet: playerBet(player),
    allIn: isAllIn(player),
    folded: isFolded(player),
    seatOut: isSeatOut(player),
    hasActedThisRound: Boolean(player?.hasActedThisRound || player?.hasActedThisStreet || player?.acted),
    lastAction: player?.lastAction ?? player?.lastAct ?? null,
    eligibleForAction:
      !isFolded(player) &&
      !isAllIn(player) &&
      !isSeatOut(player) &&
      playerStack(player) > 0,
  }));
}

function visibleButtonText(pattern) {
  if (typeof document === "undefined") return false;
  return [...document.querySelectorAll("button")].some((button) => {
    const text = button.textContent ?? "";
    const box = button.getBoundingClientRect();
    const style = window.getComputedStyle(button);
    return (
      pattern.test(text) &&
      box.width > 0 &&
      box.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      !button.disabled
    );
  });
}

function hasVisibleWaitingText() {
  if (typeof document === "undefined") return false;
  return [...document.querySelectorAll("body *")].some((element) => {
    const text = element.textContent ?? "";
    if (!WAITING_TEXT_RE.test(text)) return false;
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  });
}

function collectDeviceInfo() {
  if (typeof window === "undefined") return {};
  return {
    userAgent: window.navigator?.userAgent ?? null,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    orientation:
      window.screen?.orientation?.type ??
      (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),
    devicePixelRatio: window.devicePixelRatio ?? 1,
  };
}

export function classifyMobileWaitingFreeze(report = {}) {
  if (report.resultVisible || report.nextHandVisible || report.controller?.isTerminal) return "NOT_WAITING";
  if (!report.waitingForOtherPlayers) return "NOT_WAITING";
  const actor = report.controller?.actorSeat;
  const players = report.players ?? [];
  const actorPlayer = typeof actor === "number" ? players[actor] : null;
  if (actorPlayer?.folded) return "WAITING_FOR_FOLDED_ACTOR";
  if (actorPlayer?.allIn) return "WAITING_FOR_ALLIN_ACTOR";
  if (actorPlayer?.seatOut || actorPlayer?.stack <= 0) return "WAITING_FOR_INELIGIBLE_ACTOR";
  if ((report.controller?.playersNeedingAction ?? []).length === 0) {
    return "WAITING_WITH_NO_PENDING_ACTORS";
  }
  if (report.controller?.shouldRoundClose) return "WAITING_AFTER_ROUND_SHOULD_CLOSE";
  if (String(report.handDisplay ?? "").trim() === "5/5") return "WAITING_AT_HAND_LIMIT_5_OF_5";
  return "UNKNOWN";
}

export function buildMobileFreezeReport({
  bugId = "PHYSICAL-MOBILE-BADUGI-WAITING-001",
  label = "manual-export",
  mode = null,
} = {}) {
  if (typeof window === "undefined") return null;
  const snapshot =
    window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label, mode: mode ?? "tournament" }) ?? null;
  const e2eState = window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null;
  const phaseState = window.__BADUGI_E2E__?.getPhaseState?.() ?? null;
  const controller = snapshot?.controller ?? {};
  const rawPlayers =
    controller.players ??
    e2eState?.controllerSnapshot?.players ??
    phaseState?.players ??
    e2eState?.players ??
    [];
  const players = normalizePlayers(rawPlayers);
  const phase = normalizePhase(snapshot?.phase ?? phaseState?.phase ?? e2eState?.phase);
  const currentBet =
    numberOrNull(controller.currentBet ?? e2eState?.currentBet ?? phaseState?.currentBet) ??
    Math.max(0, ...players.map((player) => player.bet));
  const expected = expectedBrowserActor({
    phase,
    drawRound: snapshot?.drawRound ?? e2eState?.drawRound ?? phaseState?.drawRound,
    buttonSeat: snapshot?.buttonSeat ?? e2eState?.dealerIdx ?? phaseState?.dealerIdx,
    bbSeat: snapshot?.bbSeat ?? e2eState?.controllerSnapshot?.bbSeat,
    players,
    currentBet,
    actorSeat: controller.actorSeat,
  });
  const heroControlsVisible = Boolean(snapshot?.ui?.heroControlsVisible);
  const nextHandVisible = Boolean(snapshot?.ui?.nextHandVisible) || visibleButtonText(/next hand/i);
  const resultVisible = Boolean(snapshot?.ui?.resultVisible);
  const waitingForOtherPlayers = hasVisibleWaitingText() && !resultVisible && !nextHandVisible;
  const handDisplay =
    document.querySelector("[data-testid='tournament-hand-counter']")?.textContent?.trim() ??
    document.querySelector("[data-testid='hand-counter']")?.textContent?.trim() ??
    null;
  const report = {
    bugId,
    variantId: snapshot?.variantId ?? e2eState?.gameVariant ?? e2eState?.controllerSnapshot?.variantId ?? null,
    mode: mode ?? snapshot?.mode ?? e2eState?.mode ?? null,
    route: window.location?.href ?? null,
    buildInfo: window.__MGX_BUILD_INFO__ ?? {},
    device: collectDeviceInfo(),
    handDisplay,
    handId: snapshot?.handId ?? e2eState?.handId ?? null,
    phase,
    drawRound: numberOrNull(snapshot?.drawRound ?? e2eState?.drawRound ?? phaseState?.drawRound),
    betRound: numberOrNull(snapshot?.betRound ?? e2eState?.betRound ?? phaseState?.betRound),
    heroSeat: 0,
    heroPosition: players[0]?.position ?? null,
    toCall: Math.max(0, currentBet - (players[0]?.bet ?? 0)),
    currentBet,
    pot: controller.pot ?? e2eState?.potTotal ?? 0,
    displayedPot: snapshot?.ui?.displayedPot ?? null,
    waitingForOtherPlayers,
    heroControlsVisible,
    heroActionButtonsVisible: heroControlsVisible,
    resultVisible,
    nextHandVisible,
    controller: {
      actorSeat: controller.actorSeat ?? null,
      currentActor: controller.actorSeat ?? null,
      nextTurn: controller.nextTurn ?? null,
      legacyTurn: controller.legacyTurn ?? null,
      playersNeedingAction: expected.playersNeedingAction,
      shouldRoundClose: expected.shouldRoundClose,
      expectedActorSeat: expected.expectedActorSeat,
      isTerminal: Boolean(snapshot?.controller?.terminal || snapshot?.ui?.resultVisible || snapshot?.ui?.nextHandVisible),
    },
    ui: {
      actingBadgeSeat: snapshot?.ui?.actingBadgeSeat ?? null,
      visibleActingBadges: [],
      displayedPhase: snapshot?.ui?.displayedPhase ?? null,
      displayedDrawRound: numberOrNull(snapshot?.drawRound),
      displayedBetRound: numberOrNull(snapshot?.betRound),
      visibleActions: snapshot?.ui?.visibleActions ?? [],
    },
    players,
    pendingActors: expected.playersNeedingAction,
    eligibleActors: players.filter((player) => player.eligibleForAction).map((player) => player.seat),
    lastActions: window.__BADUGI_E2E__?.getCurrentHandHistory?.()?.actions ?? [],
    traceTail: window.__MGX_GAMEPLAY_TRACE__?.slice?.(-12) ?? [],
    consoleErrors: window.__MGX_CONSOLE_ERRORS__?.slice?.(-20) ?? [],
  };
  return {
    ...report,
    classification: classifyMobileWaitingFreeze(report),
    exportedAt: new Date().toISOString(),
  };
}

export function installMobileFreezeDetectorGlobals() {
  if (typeof window === "undefined") return null;
  window.__MGX_EXPORT_FREEZE_REPORT__ = buildMobileFreezeReport;
  window.__MGX_CLASSIFY_MOBILE_FREEZE__ = classifyMobileWaitingFreeze;
  return {
    exportFreezeReport: window.__MGX_EXPORT_FREEZE_REPORT__,
    classify: window.__MGX_CLASSIFY_MOBILE_FREEZE__,
  };
}
