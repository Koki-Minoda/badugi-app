function createDrawActionError(message, meta = {}) {
  const error = new Error(message);
  error.name = "DrawActionError";
  error.meta = meta;
  return error;
}

function getHand(playerOrHand) {
  if (Array.isArray(playerOrHand)) return playerOrHand;
  if (Array.isArray(playerOrHand?.hand)) return playerOrHand.hand;
  if (Array.isArray(playerOrHand?.cards)) return playerOrHand.cards;
  if (Array.isArray(playerOrHand?.holeCards)) return playerOrHand.holeCards;
  return [];
}

function getMaxDiscardCount({ hand = [], maxDiscardCount = null, variant = null, state = null } = {}) {
  const explicit = Number(maxDiscardCount);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  const fromState = Number(state?.maxDiscardCount ?? state?.metadata?.maxDiscardCount);
  if (Number.isInteger(fromState) && fromState >= 0) return fromState;
  const handSize = Number(variant?.holeCards?.count ?? variant?.handCardCount ?? state?.handCardCount);
  if (Number.isInteger(handSize) && handSize > 0) return handSize;
  return Array.isArray(hand) ? hand.length : 0;
}

export function normalizeDiscardIndexes({
  hand,
  discardIndexes,
  drawCount,
  maxDiscardCount,
  variant,
  state,
} = {}) {
  const currentHand = getHand(hand);
  const limit = getMaxDiscardCount({ hand: currentHand, maxDiscardCount, variant, state });
  const warnings = [];
  let source = "discardIndexes";
  let normalized;

  if (Array.isArray(discardIndexes)) {
    normalized = discardIndexes.map((idx) => Number(idx));
  } else if (Array.isArray(discardIndexes?.indexes)) {
    normalized = discardIndexes.indexes.map((idx) => Number(idx));
  } else if (Number.isInteger(Number(drawCount))) {
    source = "drawCount";
    const count = Number(drawCount);
    if (count < 0 || count > limit || count > currentHand.length) {
      throw createDrawActionError("drawCount is outside the legal discard range", {
        drawCount: count,
        maxDiscardCount: limit,
        handSize: currentHand.length,
      });
    }
    normalized = Array.from({ length: count }, (_, index) => index);
  } else {
    normalized = [];
  }

  if (normalized.some((idx) => !Number.isInteger(idx))) {
    throw createDrawActionError("discardIndexes must be integers", { discardIndexes });
  }
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw createDrawActionError("discardIndexes must be unique", { discardIndexes: normalized });
  }
  normalized.forEach((idx) => {
    if (idx < 0 || idx >= currentHand.length) {
      throw createDrawActionError("discardIndexes contains an out-of-range index", {
        discardIndexes: normalized,
        handSize: currentHand.length,
      });
    }
  });
  if (normalized.length > limit) {
    throw createDrawActionError("discardIndexes exceeds maxDiscardCount", {
      discardIndexes: normalized,
      maxDiscardCount: limit,
    });
  }
  if (Number.isInteger(Number(drawCount)) && Number(drawCount) !== normalized.length) {
    warnings.push({
      code: "DRAW_COUNT_MISMATCH",
      drawCount: Number(drawCount),
      discardIndexesLength: normalized.length,
    });
  }

  return {
    discardIndexes: [...normalized].sort((a, b) => a - b),
    drawCount: normalized.length,
    maxDiscardCount: limit,
    source,
    warnings,
  };
}

export function normalizeDrawAction({ action = {}, player = null, variant = null, state = null } = {}) {
  const payload = action.payload ?? action.metadata ?? action;
  const hand = getHand(player);
  const discardIndexes =
    payload.discardIndexes ??
    payload.drawIndexes ??
    payload.discardedIndexes ??
    action.discardIndexes ??
    action.drawIndexes;
  const drawCount =
    payload.drawCount ??
    payload.discardCount ??
    action.drawCount ??
    action.discardCount ??
    (Array.isArray(discardIndexes) ? discardIndexes.length : undefined);
  const normalized = normalizeDiscardIndexes({
    hand,
    discardIndexes,
    drawCount,
    variant,
    state,
    maxDiscardCount:
      payload.maxDiscardCount ?? action.maxDiscardCount ?? state?.maxDiscardCount ?? state?.metadata?.maxDiscardCount,
  });
  return {
    ...action,
    ...payload,
    type: "DRAW",
    discardIndexes: normalized.discardIndexes,
    drawIndexes: normalized.discardIndexes,
    drawCount: normalized.drawCount,
    discardCount: normalized.drawCount,
    pat: normalized.drawCount === 0,
    drawNormalization: {
      source: normalized.source,
      maxDiscardCount: normalized.maxDiscardCount,
      warnings: normalized.warnings,
    },
  };
}

export function validateDrawAction({ action = {}, player = null, state = {}, variant = null } = {}) {
  if (!player) {
    throw createDrawActionError("Seat cannot draw because player is missing");
  }
  if (player.folded || player.hasFolded || player.seatOut || player.sittingOut || player.isBusted) {
    throw createDrawActionError("Seat cannot draw in the current round", {
      seatIndex: player.seatIndex,
    });
  }
  if (player.hasDrawn || player.hasActedThisRound === true) {
    throw createDrawActionError("Seat has already drawn this round", {
      seatIndex: player.seatIndex,
    });
  }
  const seatIndex = player.seatIndex ?? action.seatIndex;
  if (
    Array.isArray(state.pendingDrawSeats ?? state.metadata?.pendingDrawSeats) &&
    (state.pendingDrawSeats ?? state.metadata?.pendingDrawSeats).length > 0 &&
    !new Set((state.pendingDrawSeats ?? state.metadata?.pendingDrawSeats).map(Number)).has(Number(seatIndex))
  ) {
    throw createDrawActionError("Seat is not pending for draw", { seatIndex });
  }
  return normalizeDrawAction({ action, player, state, variant });
}

export default normalizeDrawAction;
