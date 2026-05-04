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
  return baseSeats.map((base, idx) => {
    const override = adapterSeatViews[idx];
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
      const reveal = Boolean(base?.showHand) || shouldRevealSeatHand(phase, base);
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
      cards: override.cards ?? base.cards ?? [],
      hand: override.hand ?? base.hand ?? [],
    };
    return {
      ...merged,
      showHand:
        Boolean(base?.showHand) ||
        Boolean(override.showHand) ||
        shouldRevealSeatHand(phase, merged),
    };
  });
}
