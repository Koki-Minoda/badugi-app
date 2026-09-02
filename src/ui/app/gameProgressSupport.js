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
