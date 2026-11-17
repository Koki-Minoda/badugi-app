const reviewKey = userId => `mgx.badugiRangeReviews.v1:${userId}`;

export function readBadugiRangeReviews(userId) {
  if (userId == null) return [];
  try {
    const entries = JSON.parse(localStorage.getItem(reviewKey(userId)));
    return Array.isArray(entries) ? entries.filter(entry => entry?.handId &&
      Number.isInteger(entry.actionSeq) && [1, 2, 3].includes(entry.remainingDraws) && Array.isArray(entry.deadCards) &&
      Array.isArray(entry.assumptions) && entry.assumptions.length === 2 &&
      entry.assumptions.every(assumption => typeof assumption?.text === 'string') &&
      Array.isArray(entry.result?.actions) && Array.isArray(entry.result?.endpoints) &&
      Array.isArray(entry.result?.transitions) && entry.result?.ranges?.length === 2) : [];
  } catch {
    return [];
  }
}

export function saveBadugiRangeComparison(userId, spot, comparison, result, note) {
  if (userId == null || !spot?.handId || spot.actionSeq == null || result?.error || !result?.actions?.length) return false;
  const { assumptions, count, base } = comparison;
  if (spot.observedCount != null && spot.observedCount !== count) return false;
  if (base.remainingDraws !== spot.remainingDraws || spot.cards.some(card => !base.hands[0].includes(card))) return false;
  const entry = {
    handId: spot.handId,
    actionSeq: spot.actionSeq,
    remainingDraws: spot.remainingDraws,
    observedCount: spot.observedCount,
    count,
    deadCards: base.deadCards,
    assumptions,
    result,
    note: note.trim(),
    at: Date.now(),
  };
  const previous = readBadugiRangeReviews(userId).filter(review =>
    review.handId !== entry.handId || review.actionSeq !== entry.actionSeq);
  try {
    localStorage.setItem(reviewKey(userId), JSON.stringify([entry, ...previous].slice(0, 100)));
    return true;
  } catch {
    return false;
  }
}
