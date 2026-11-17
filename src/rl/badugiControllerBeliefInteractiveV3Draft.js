// Candidate-only actor-visible evidence. The published v2 inference path stays unchanged.
import { BadugiControllerInteractiveV2Draft } from './badugiControllerInteractiveV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from './badugiControllerSeatEventViewV2Draft.js';

const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';

function cardTuple(card) {
  const match = typeof card === 'string'
    ? card.trim().toUpperCase().match(/^(10|[2-9TAJQK])([CDHS])$/) : null;
  if (!match) throw new TypeError('belief evidence requires actor-visible card');
  return [RANKS.indexOf(match[1] === '10' ? 'T' : match[1]), SUITS.indexOf(match[2])];
}

export class BadugiControllerBeliefInteractiveV3Draft extends BadugiControllerInteractiveV2Draft {
  currentDecision() {
    const decision = super.currentDecision();
    const seat = decision.seat;
    const visible = buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: this.publicEvents, actorDrawEvents: this.actorDrawEvents[seat], seatIndex: seat,
    });
    const snapshot = this.controller.getUiSnapshot(this.state);
    const actorCards = snapshot.players[seat].hand.map(cardTuple);
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
      // Showdown identities are omitted until a separately audited public reveal exists.
      showdownCardsIncluded: false,
    } };
  }
}
