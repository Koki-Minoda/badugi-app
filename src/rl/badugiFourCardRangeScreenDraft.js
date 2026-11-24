// Offline seed screening for development case/control matching. No private
// opponent card from here is passed to the hero policy or range estimator.
import { BadugiControllerInteractiveV2Draft } from './badugiControllerInteractiveV2Draft.js';
import { evaluateHand } from '../games/badugi/utils/badugiEvaluator.js';

const RANKS = 'A23456789TJQK';

function scoreSnapshotHand(cards) {
  return evaluateHand(cards.map((card) => {
    const match = typeof card === 'string'
      ? card.toUpperCase().match(/^(10|[2-9TAJQK])([CDHS])$/) : null;
    if (!match) throw new TypeError('offline screen requires canonical card');
    return { rank: RANKS.indexOf(match[1] === '10' ? 'T' : match[1]) + 1,
      suit: match[2] };
  }));
}

export function screenFourCardRangeInitialDealDraft({ seed, isTournament }) {
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
  const hands = snapshot.players.map((player) => player.hand);
  if (hands.length !== 6 || hands.some((hand) => hand.length !== 4) ||
      new Set(hands.flat()).size !== 24) {
    throw new TypeError('screen found an invalid or duplicated private deal');
  }
  const targets = hands.flatMap((hand, seat) => {
    const score = scoreSnapshotHand(hand);
    if (score.count !== 4 || Math.max(...score.ranks) > 9) return [];
    return [{ seat, class: Math.max(...score.ranks) <= 5 ? 'A5' : 'SIX_NINE',
      ranks: score.ranks, cards: hand }];
  });
  return { seed, isTournament, firstActorSeat: first.seat, targets,
    ledger: { accounted: first.ledger.accounted,
      chipPool: first.ledger.chipPool } };
}
