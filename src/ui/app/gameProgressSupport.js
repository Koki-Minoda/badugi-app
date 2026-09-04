import { isValidHandShapeForVariant } from "../utils/handShapeInvariant.js";
import { normalizeAppVariantId } from "../game/appVariantRouting.js";

export function snapshotVariantMatchesAppVariant(snapshot, appVariant) {
  if (!snapshot) return false;
  const expected = normalizeAppVariantId(appVariant);
  const actual = normalizeAppVariantId(
    snapshot.variantId ??
      snapshot.gameVariant ??
      snapshot.gameId ??
      snapshot.metadata?.variantId,
    null,
  );
  if (actual && actual !== expected) return false;
  return isValidHandShapeForVariant({ variantId: expected, snapshot });
}

export function normalizeControllerLegalActionType(action) {
  return String(
    typeof action === "string" ? action : (action?.type ?? ""),
  ).toUpperCase();
}

export function buildSafeControllerBetAction({
  legalActions = [],
  currentBet = 0,
  actorBet = 0,
} = {}) {
  const legal = new Set(
    (legalActions ?? [])
      .map(normalizeControllerLegalActionType)
      .filter(Boolean),
  );
  const toCall = Math.max(0, Number(currentBet ?? 0) - Number(actorBet ?? 0));
  if (toCall > 0 && legal.has("CALL")) {
    return {
      type: "CALL",
      amount: toCall,
      decisionSource: "controller-safe-fallback",
      fallbackReason: "cpu-action-unavailable",
    };
  }
  if (toCall === 0 && legal.has("CHECK")) {
    return {
      type: "CHECK",
      amount: 0,
      decisionSource: "controller-safe-fallback",
      fallbackReason: "cpu-action-unavailable",
    };
  }
  if (legal.has("FOLD")) {
    return {
      type: "FOLD",
      amount: 0,
      decisionSource: "controller-safe-fallback",
      fallbackReason: "cpu-action-unavailable",
    };
  }
  return null;
}

export function clonePlayerState(player) {
  if (!player) return null;
  return {
    ...player,
    hand: Array.isArray(player.hand) ? [...player.hand] : player.hand,
    cards: Array.isArray(player.cards) ? [...player.cards] : player.cards,
    holeCards: Array.isArray(player.holeCards)
      ? [...player.holeCards]
      : player.holeCards,
    selected: Array.isArray(player.selected)
      ? [...player.selected]
      : player.selected,
  };
}

export function rotateSeatBlueprint(config = [], direction = 1) {
  if (!Array.isArray(config) || config.length <= 1) return [...config];
  const head = config[0];
  const rest = config.slice(1);
  const offset = ((direction % rest.length) + rest.length) % rest.length;
  return [head, ...rest.map((_, index) => rest[(index - offset + rest.length) % rest.length])];
}

export function applyHeroProfile(list = [], profile) {
  if (!profile) return list;
  return list.map((player, index) => index === 0 ? {
    ...player,
    name: profile.name,
    titleBadge: profile.titleBadge,
    avatar: profile.avatar,
  } : player);
}

export function canContinueGame(snapshot = []) {
  return (Array.isArray(snapshot) ? snapshot : []).filter((player) =>
    player &&
    !player.seatOut &&
    !player.isBusted &&
    player.isSeated !== false &&
    player.isActiveInGame !== false &&
    String(player.seatType ?? "").toUpperCase() !== "EMPTY" &&
    Number(player.stack) > 0
  ).length >= 2;
}

export function getCashCpuReseatStack(player = {}, baseline = {}, fallbackStack = 0) {
  const stack = Number(player.rebuyStack) || Number(player.initialStack) ||
    Number(baseline.rebuyStack) || Number(baseline.initialStack) || Number(fallbackStack);
  return Math.max(1, stack || 1);
}

export function markCashCpuOut(player = {}, bustHandIndex = 0) {
  return {
    ...player,
    stack: 0,
    isBusted: true,
    busted: true,
    seatOut: true,
    folded: true,
    hasFolded: true,
    allIn: false,
    hand: [],
    cards: [],
    selected: [],
    bet: 0,
    betThisRound: 0,
    totalInvested: 0,
    hasActedThisRound: true,
    hasDrawn: true,
    canDraw: false,
    lastDrawCount: 0,
    lastAction: "OUT",
    bustHandIndex: typeof player.bustHandIndex === "number" ? player.bustHandIndex : bustHandIndex,
  };
}
