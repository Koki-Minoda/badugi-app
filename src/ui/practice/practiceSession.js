import { DeckManager } from '../../games/badugi/utils/deck.js';
import { BadugiGameController } from '../../games/badugi/controller/BadugiGameController.js';
import { DeuceToSevenTripleDrawController } from '../../games/draw/DeuceToSevenTripleDrawController.js';
import { AceToFiveTripleDrawController } from '../../games/draw/AceToFiveTripleDrawController.js';
import { DeuceToSevenTripleDrawEngine } from '../../games/draw/DeuceToSevenTripleDrawEngine.js';
import { AceToFiveTripleDrawEngine } from '../../games/draw/AceToFiveTripleDrawEngine.js';
import { chooseBadugiProStrategy } from '../../ai/pro/strategies/badugiProStrategy.js';

import { PRACTICE_GAMES, validatePracticeSetup } from './practiceSetup.js';
export { PRACTICE_GAMES, PRACTICE_CARDS, validatePracticeSetup } from './practiceSetup.js';

// This deck is only constructed inside the practice route. The normal game
// factories and their random deal behavior are untouched.
class PracticeDeck extends DeckManager {
  constructor(cards, rng) { super({ rng }); this.heroCards = [...cards]; }
  reset() {
    super.reset();
    this.deck = [...this.deck.filter(card => !this.heroCards.includes(card)), ...this.heroCards.slice().reverse()];
  }
}
const clone = value => JSON.parse(JSON.stringify(value));
export class PracticeSession {
  constructor(variant, cards, { rng = Math.random } = {}) {
    if (!validatePracticeSetup(variant, cards)) throw new Error('Invalid practice hand');
    this.variant = variant;
    this.initialCards = [...cards];
    this.deck = new PracticeDeck(cards, rng);
    this.handId = `practice-${crypto.randomUUID()}`;
    this.startedAt = Date.now();
    const config = { numSeats: 6, seatConfig: ['HUMAN', 'CPU', 'CPU', 'CPU', 'CPU', 'CPU'], startingStack: 2000, heroProfile: { name: 'You' }, blindStructure: [{ sb: 10, bb: 20, ante: 0 }], structure: { sb: 10, bb: 20, ante: 0 } };
    if (variant === 'badugi') {
      this.controller = new BadugiGameController(config);
      this.deck.reset();
    } else {
      const Engine = variant === 'ace_to_five_triple_draw' ? AceToFiveTripleDrawEngine : DeuceToSevenTripleDrawEngine;
      const Controller = variant === 'ace_to_five_triple_draw' ? AceToFiveTripleDrawController : DeuceToSevenTripleDrawController;
      this.controller = new Controller({ engine: new Engine({ deckManager: this.deck }), tableConfig: config });
    }
    const initial = this.controller.createInitialState(config);
    this.state = this.controller.createNewHandState(initial, { ...config, handId: this.handId, nextDealerIdx: 0, drawCardsForSeat: () => this.deck.draw(4) });
    this.initialPlayers = clone(this.snapshot.players);
    this.events = [{ type: 'HAND_START', timestamp: this.startedAt }, { type: 'BLINDS_POSTED', sbSeat: 1, bbSeat: 2, sbAmount: 10, bbAmount: 20 }];
    this.revision = 0;
    this.assertCards();
  }
  get snapshot() { return this.controller.getUiSnapshot(this.state); }
  get finished() { return this.controller.isHandFinished(this.state); }
  get actor() { return this.snapshot.turn ?? this.snapshot.nextTurn; }
  legalActions(seat = this.actor) {
    if (this.finished) return [];
    const actions = this.controller.getLegalActions(this.state, seat);
    return actions.filter(action => this.snapshot.phase === 'DRAW' ? action.type === 'DRAW' : action.type !== 'DRAW');
  }
  assertCards() {
    const hands = this.snapshot.players.flatMap(player => player.hand ?? []);
    const all = [...hands, ...this.deck.deck, ...this.deck.discardPile, ...this.deck.burnPile];
    if (all.length !== 52 || new Set(all).size !== 52) throw new Error('Practice deck integrity error');
  }
  act(seat, input, expectedRevision = this.revision) {
    if (expectedRevision !== this.revision || this.finished || seat !== this.actor) return false;
    const type = String(input.type).toUpperCase();
    if (!this.legalActions(seat).some(action => action.type === type)) throw new Error('Illegal practice action');
    const before = this.snapshot;
    const indexes = input.discardIndexes ?? [];
    if (type === 'DRAW' && (!Array.isArray(indexes) || new Set(indexes).size !== indexes.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= before.players[seat].hand.length))) throw new Error('Invalid draw selection');
    const payload = { type, discardIndexes: indexes };
    if (this.variant === 'badugi' && type === 'DRAW') {
      const hand = [...before.players[seat].hand];
      const discarded = indexes.map(index => hand[index]);
      this.deck.discard(discarded);
      const drawn = this.deck.draw(indexes.length, { activeCards: before.players.flatMap(player => player.hand).filter(card => !discarded.includes(card)) });
      payload.handAfter = hand;
      payload.replacedCards = indexes.map((index, i) => { hand[index] = drawn[i]; return { index, newCard: drawn[i] }; });
    }
    const result = this.controller.applyAction(this.state, { seatIndex: seat, type, discardIndexes: indexes, payload });
    if (result.events?.some(event => ['error', 'invalidAction'].includes(event.type))) throw new Error('Practice action was rejected');
    this.state = result.state;
    this.revision += 1;
    const after = this.snapshot;
    const received = this.finished ? (after.lastHandResult?.winners ?? []).filter(winner => winner.seatIndex === seat).reduce((sum, winner) => sum + (winner.payout ?? 0), 0) : 0;
    this.events.push({ type: type === 'DRAW' ? 'DRAW_ACTION' : 'BET_ACTION', seat, action: type.toLowerCase(), street: before.phase, drawRound: before.drawRound, drawCount: type === 'DRAW' ? indexes.length : undefined, amount: type === 'DRAW' ? undefined : Math.max(0, before.players[seat].stack - after.players[seat].stack + received), timestamp: Date.now() });
    if (before.phase !== after.phase) this.events.push({ type: 'PHASE_TRANSITION', from: before.phase, to: after.phase });
    this.assertCards();
    if (this.finished) {
      this.endedAt = Date.now();
      this.events.push({ type: 'HAND_END', totalPot: after.lastHandResult?.pot ?? 0, winners: (after.lastHandResult?.winners ?? []).map(winner => ({ seat: winner.seatIndex, name: winner.name, amount: winner.payout })), finalStacks: after.players.map((player, seatIndex) => ({ seat: seatIndex, stack: player.stack })), timestamp: this.endedAt });
    }
    return true;
  }
  cpuAction() {
    const seat = this.actor;
    if (seat === 0 || this.finished) return false;
    const legal = this.legalActions(seat);
    const candidate = this.variant === 'badugi'
      ? chooseBadugiProStrategy({ snapshot: this.snapshot, legalActions: legal, actor: { ...this.snapshot.players[seat], seatIndex: seat } })
      : this.controller.getCpuAction(this.state, seat);
    const allowed = legal.some(action => action.type === String(candidate?.type).toUpperCase());
    const fallback = legal.find(action => ['CHECK', 'CALL', 'DRAW'].includes(action.type)) ?? legal[0];
    if (!fallback) throw new Error('No available practice action');
    return this.act(seat, allowed ? candidate : { ...fallback, discardIndexes: [] });
  }
  record() {
    if (!this.finished) return null;
    const snapshot = this.snapshot;
    return { handId: this.handId, variantId: this.variant, variantName: PRACTICE_GAMES.find(game => game.id === this.variant).name, startedAt: this.startedAt, endedAt: this.endedAt, mode: 'practice', historySource: 'practice', buttonSeat: 0, sbSeat: 1, bbSeat: 2, pot: snapshot.lastHandResult?.pot ?? 0, events: clone(this.events), seats: snapshot.players.map((player, seat) => ({ seat, name: player.name, isHero: seat === 0, initialHand: [...this.initialPlayers[seat].hand], hand: [...player.hand], startStack: 2000, endStack: player.stack, folded: player.folded })), practiceSetup: { variant: this.variant, cards: [...this.initialCards] } };
  }
}
