export function getMaxDiscardCount({ maxDiscardCount = null, hand = [] } = {}) {
  const handSize = Array.isArray(hand) ? hand.length : 0;
  const requested = Number(maxDiscardCount);
  const cap = Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : handSize;
  return handSize > 0 ? Math.min(cap, handSize) : cap;
}

export function toggleDrawSelection(selection = [], cardIndex, options = {}) {
  const current = Array.isArray(selection) ? [...selection] : [];
  if (!Number.isInteger(cardIndex) || cardIndex < 0) return current;
  if (current.includes(cardIndex)) {
    return current.filter((idx) => idx !== cardIndex);
  }
  const maxDiscardCount = getMaxDiscardCount(options);
  if (current.length >= maxDiscardCount) return current;
  return [...current, cardIndex];
}
