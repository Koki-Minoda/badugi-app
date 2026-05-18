export const ALL_IN_VISIBILITY = Object.freeze({
  SHOWDOWN_ONLY: "SHOWDOWN_ONLY",
  ACTION_COMPLETE: "ACTION_COMPLETE",
});

const DRAW_SHOWDOWN_ONLY_VARIANTS = new Set([
  "badugi",
  "d03",
  "d01",
  "d02",
  "s01",
  "s02",
  "deuce_to_seven_triple_draw",
  "ace_to_five_triple_draw",
  "deuce_to_seven_single_draw",
  "ace_to_five_single_draw",
]);

const BOARD_ACTION_COMPLETE_VARIANTS = new Set([
  "nlh",
  "flh",
  "b01",
  "b02",
  "plo",
  "plo8",
  "flo8",
  "big_o",
  "bigo",
  "five_card_plo",
  "5_card_plo",
  "pot_limit_omaha",
  "omaha",
  "omaha8",
]);

const SHOWDOWN_PHASES = new Set([
  "SHOWDOWN",
  "HAND_RESULT",
  "RESULT",
  "WAITING_NEXT_HAND",
  "COMPLETE",
  "TERMINAL",
]);

function normalizeVariantId(variantId) {
  return String(variantId ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

export function getAllInVisibilityPolicy(variantId) {
  const normalized = normalizeVariantId(variantId);
  if (BOARD_ACTION_COMPLETE_VARIANTS.has(normalized)) {
    return ALL_IN_VISIBILITY.ACTION_COMPLETE;
  }
  if (DRAW_SHOWDOWN_ONLY_VARIANTS.has(normalized)) {
    return ALL_IN_VISIBILITY.SHOWDOWN_ONLY;
  }
  return ALL_IN_VISIBILITY.SHOWDOWN_ONLY;
}

export function isShowdownVisibilityPhase({ phase, street } = {}) {
  return SHOWDOWN_PHASES.has(String(phase ?? street ?? "").toUpperCase());
}

export function shouldRevealPlayerHand({
  variantId,
  player = {},
  seatIndex = null,
  heroSeat = 0,
  phase = null,
  street = null,
  allInActionComplete = false,
} = {}) {
  if (seatIndex === heroSeat) return true;
  if (!player || player.folded || player.hasFolded || player.seatOut || player.isBusted || player.busted) {
    return false;
  }
  if (isShowdownVisibilityPhase({ phase, street })) {
    return true;
  }

  const policy = getAllInVisibilityPolicy(variantId);
  if (policy === ALL_IN_VISIBILITY.ACTION_COMPLETE) {
    return Boolean(player.allIn && allInActionComplete);
  }
  return false;
}
