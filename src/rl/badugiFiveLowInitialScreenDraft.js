// Offline seed screening only. Private hands never enter the candidate policy
// or the public evidence bridge; selected seeds are development data.
import { BadugiControllerInteractiveV2Draft } from './badugiControllerInteractiveV2Draft.js';
import { evaluateHand } from '../games/badugi/utils/badugiEvaluator.js';

const RANKS = 'A23456789TJQK';

function evaluateSnapshotHand(hand) {
  return evaluateHand(hand.map((card) => {
    const match = typeof card === 'string'
      ? card.toUpperCase().match(/^(10|[2-9TAJQK])([CDHS])$/) : null;
    if (!match) throw new TypeError('screen requires canonical private card');
    return { rank: RANKS.indexOf(match[1] === '10' ? 'T' : match[1]) + 1,
      suit: match[2] };
  }));
}

export function screenFiveLowInitialDealDraft({ seed, isTournament }) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff ||
      typeof isTournament !== 'boolean') {
    throw new TypeError('screen requires uint32 seed and mode');
  }
  const session = new BadugiControllerInteractiveV2Draft({
    seatCount: 6, occupiedSeatCount: 6, isTournament, seed, includeLedger: true,
  });
  const first = session.nextHand();
  if (first.type !== 'decision' || first.ledger.accounted !== first.ledger.chipPool) {
    throw new TypeError('screen requires a valid real-controller deal');
  }
  const snapshot = session.controller.getUiSnapshot(session.state);
  const cards = snapshot.players.map((player) => player.hand);
  if (cards.length !== 6 || cards.some((hand) => hand.length !== 4) ||
      new Set(cards.flat()).size !== 24) {
    throw new TypeError('screen found an invalid or duplicated private deal');
  }
  const targets = cards.flatMap((hand, seat) => {
    const score = evaluateSnapshotHand(hand);
    return score.count === 4 && Math.max(...score.ranks) <= 5
      ? [{ seat, ranks: score.ranks, cards: hand }] : [];
  });
  return { seed, isTournament, firstActorSeat: first.seat,
    targets, ledger: { accounted: first.ledger.accounted,
      chipPool: first.ledger.chipPool } };
}
