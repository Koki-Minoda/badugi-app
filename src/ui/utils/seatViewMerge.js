const REVEAL_HAND_PHASES = new Set([
  "SHOWDOWN",
  "HAND_RESULT",
  "WAITING_NEXT_HAND",
  "TABLE_FINISHED",
]);

export function shouldRevealSeatHand(phase, seat = {}) {
  if (!REVEAL_HAND_PHASES.has(phase)) return false;
  if (seat.isHero) return true;
  if (seat.folded || seat.hasFolded || seat.seatOut) return false;
  return Array.isArray(seat.hand) && seat.hand.length > 0;
}

export function mergeSeatViewsForDisplay({
  baseSeats = [],
  adapterSeatViews = [],
  phase = null,
} = {}) {
  const revealPhase = REVEAL_HAND_PHASES.has(phase);
  return baseSeats.map((base, idx) => {
    const override = adapterSeatViews[idx];
    const baseHand = Array.isArray(base?.hand) ? base.hand : [];
    const overrideHand = Array.isArray(override?.hand) ? override.hand : [];
    const baseCards = Array.isArray(base?.cards) ? base.cards : baseHand;
    const overrideCards = Array.isArray(override?.cards) ? override.cards : overrideHand;
    const baseAvatarUrl = base?.avatarUrl ?? null;
    const overrideAvatarUrl = override?.avatarUrl ?? null;
    const baseAvatar = base?.avatar ?? baseAvatarUrl ?? null;
    const overrideAvatar = override?.avatar ?? null;
    const avatarUrl = overrideAvatarUrl ?? baseAvatarUrl;
    const avatar =
      overrideAvatar && overrideAvatar !== "default_avatar"
        ? overrideAvatar
        : baseAvatar ?? avatarUrl ?? "default_avatar";
    if (!override) {
      const reveal =
        Boolean(base?.isHero) ||
        (revealPhase && (Boolean(base?.showHand) || shouldRevealSeatHand(phase, base)));
      return {
        ...base,
        avatar,
        avatarUrl,
        showHand: reveal,
      };
    }

    const merged = {
      ...base,
      ...override,
      avatar,
      avatarUrl,
      cards: overrideCards.length > 0 ? overrideCards : baseCards,
      hand: overrideHand.length > 0 ? overrideHand : baseHand,
    };
    return {
      ...merged,
      showHand:
        Boolean(merged?.isHero) ||
        (revealPhase &&
          (Boolean(base?.showHand) ||
            Boolean(override.showHand) ||
            shouldRevealSeatHand(phase, merged))),
    };
  });
}
