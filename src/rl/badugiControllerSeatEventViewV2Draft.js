// Offline D03 draft. A model seat sees public actions and only its own
// discarded card identities. Strip unrelated canonical event fields here.
export function buildBadugiControllerSeatEventViewV2Draft({
  publicEvents, actorDrawEvents, seatIndex,
}) {
  if (!Array.isArray(publicEvents) || !Array.isArray(actorDrawEvents) ||
      !Number.isInteger(seatIndex) || seatIndex < 0) {
    throw new TypeError('v2 draft requires a seat and separate event streams');
  }
  const privateByRound = new Map();
  for (const event of actorDrawEvents) {
    if (event?.type !== 'DRAW_ACTION' || event.seat !== seatIndex ||
        !Number.isInteger(event.drawRoundIndex) ||
        privateByRound.has(event.drawRoundIndex)) {
      throw new TypeError('v2 draft requires one actor-only draw event per round');
    }
    privateByRound.set(event.drawRoundIndex, event);
  }
  const used = new Set();
  const view = [];
  for (const event of publicEvents) {
    if (event?.type === 'BET_ACTION') {
      view.push({ type: 'BET_ACTION', seat: event.seat,
        drawRoundIndex: event.drawRoundIndex, betRoundIndex: event.betRoundIndex,
        action: event.action, amount: event.amount,
        betBefore: event.betBefore, betAfter: event.betAfter });
      continue;
    }
    if (event?.type !== 'DRAW_ACTION') continue;
    const projected = { type: 'DRAW_ACTION', seat: event.seat,
      drawRoundIndex: event.drawRoundIndex, betRoundIndex: event.betRoundIndex,
      drawCount: event.drawCount };
    if (event.seat === seatIndex) {
      const privateEvent = privateByRound.get(event.drawRoundIndex);
      if (!privateEvent || privateEvent.drawCount !== event.drawCount ||
          !Array.isArray(privateEvent.replacedCards) ||
          privateEvent.replacedCards.length !== event.drawCount) {
        throw new TypeError('v2 draft requires the actor\'s matching private draw cards');
      }
      projected.replacedCards = privateEvent.replacedCards.map((entry) => ({
        oldCard: entry.oldCard, newCard: entry.newCard,
      }));
      used.add(event.drawRoundIndex);
    }
    view.push(projected);
  }
  if (used.size !== privateByRound.size) {
    throw new TypeError('v2 draft rejects orphaned actor-only draw events');
  }
  return view;
}
