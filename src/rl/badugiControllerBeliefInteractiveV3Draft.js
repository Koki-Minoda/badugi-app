// Candidate-only actor-visible evidence. The published v2 inference path stays unchanged.
import { BadugiControllerInteractiveV2Draft } from './badugiControllerInteractiveV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from './badugiControllerSeatEventViewV2Draft.js';
import { evaluateHand } from '../games/badugi/utils/badugiEvaluator.js';

const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';

function cardTuple(card) {
  const match = typeof card === 'string'
    ? card.trim().toUpperCase().match(/^(10|[2-9TAJQK])([CDHS])$/) : null;
  if (!match) throw new TypeError('belief evidence requires actor-visible card');
  return [RANKS.indexOf(match[1] === '10' ? 'T' : match[1]), SUITS.indexOf(match[2])];
}

function quality(cards) {
  const result = evaluateHand(cards.map(([rank, suit]) => ({ rank: rank + 1, suit: SUITS[suit] })));
  return { madeCards: result.count, highRank: result.ranks[result.ranks.length - 1] - 1 };
}

function emptyHistory() {
  return { handsObserved: 0, fold: 0, check: 0, call: 0, bet: 0, raise: 0,
    raiseAmountBbSum: 0, drawCounts: [0, 0, 0, 0, 0] };
}

export class BadugiControllerBeliefInteractiveV3Draft extends BadugiControllerInteractiveV2Draft {
  nextHand() {
    this.publicHistory ??= Array.from({ length: this.seatCount }, emptyHistory);
    if (this.handIndex >= 0 && this.complete) {
      const acted = new Set();
      for (const event of this.publicEvents) {
        const history = this.publicHistory[event.seat];
        if (!history) throw new TypeError('belief history requires a valid public seat');
        acted.add(event.seat);
        if (event.type === 'BET_ACTION') {
          history[event.action] += 1;
          if (event.action === 'raise') {
            history.raiseAmountBbSum += event.amount /
              this.blindStructure[this.state.blindState.blindLevelIndex].bb;
          }
        } else if (event.type === 'DRAW_ACTION') {
          history.drawCounts[event.drawCount] += 1;
        }
      }
      for (const seat of acted) this.publicHistory[seat].handsObserved += 1;
    }
    this.initialActorHands = new Map();
    return super.nextHand();
  }

  currentDecision() {
    const decision = super.currentDecision();
    const seat = decision.seat;
    const visible = buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: this.publicEvents, actorDrawEvents: this.actorDrawEvents[seat], seatIndex: seat,
    });
    const snapshot = this.controller.getUiSnapshot(this.state);
    const actorCards = snapshot.players[seat].hand.map(cardTuple);
    if (!this.initialActorHands.has(seat)) this.initialActorHands.set(seat, actorCards);
    const initial = quality(this.initialActorHands.get(seat));
    const current = quality(actorCards);
    const seen = new Map(actorCards.map((card) => [card.join(':'), card]));
    for (const event of visible) {
      if (event.type !== 'DRAW_ACTION' || event.seat !== seat) continue;
      for (const replacement of event.replacedCards) {
        for (const card of [replacement.oldCard, replacement.newCard].map(cardTuple)) {
          seen.set(card.join(':'), card);
        }
      }
    }
    const publicActions = visible.map((event) => event.type === 'BET_ACTION'
      ? { type: 'BET_ACTION', seat: event.seat, action: event.action.toUpperCase(),
        amountBb: event.amount / decision.activeBigBlind,
        drawRoundIndex: event.drawRoundIndex }
      : { type: 'DRAW_ACTION', seat: event.seat, drawCount: event.drawCount,
        drawRoundIndex: event.drawRoundIndex });
    return { ...decision, beliefEvidence: {
      actorSeenCards: [...seen.values()], publicActions,
      actorHandProgress: { initial, current,
        madeCardGain: current.madeCards - initial.madeCards,
        highRankChange: current.highRank - initial.highRank },
      opponentPublicHistory: this.publicHistory.map((history, index) =>
        index === seat ? null : { ...history, drawCounts: [...history.drawCounts] }),
      // Showdown identities are omitted until a separately audited public reveal exists.
      showdownCardsIncluded: false,
    } };
  }
}
