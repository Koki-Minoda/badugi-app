import { autoArrangeChineseHand } from './ChinesePokerController.js';
import { OFC_ROWS, evaluateOfcRows, qualifiesForFantasyland, scoreOfcPair } from './ofcRules.js';
const clone = value => JSON.parse(JSON.stringify(value));
const newRows = () => ({ front: [], middle: [], back: [] });
const deck52 = () => ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].flatMap(r => ['C','D','H','S'].map(s => r + s));
const rank = card => ({ A: 14, K: 13, Q: 12, J: 11 }[card.slice(0, -1)] ?? Number(card.slice(0, -1)));

export class OpenFaceChineseController {
  constructor({ random = Math.random, deck = null, fantasy = [false, false], dealer = 1, handNumber = 0, scores = [0, 0] } = {}) {
    this.random = random; this.sourceDeck = deck; this.fantasy = [...fantasy]; this.dealer = dealer; this.handNumber = handNumber; this.scores = [...scores]; this.phase = 'idle';
  }
  startNewHand() {
    if (this.phase !== 'idle' && this.phase !== 'showdown') throw Error('Finish the current hand first');
    if (this.phase === 'showdown') { this.fantasy = this.result.nextFantasy; if (!this.fantasy.some(Boolean)) this.dealer = 1 - this.dealer; }
    this.deck = this.sourceDeck ? [...this.sourceDeck] : deck52();
    if (this.deck.length !== 52 || new Set(this.deck).size !== 52 || this.deck.some(c => !deck52().includes(c))) throw Error('A complete unique deck is required');
    if (!this.sourceDeck) for (let i = 51; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
    this.handNumber++; this.handId = `ofc-${Date.now()}-${this.handNumber}`; this.cursor = 0; this.street = 0; this.events = []; this.phase = 'placing'; this.result = null;
    this.players = [0, 1].map(seat => ({ seat, name: seat ? 'Mina' : 'You', rows: newRows(), pending: [], fantasy: this.fantasy[seat] }));
    this.initial = { fantasy: [...this.fantasy], dealer: this.dealer, scores: [...this.scores] };
    this.beginStreet(); return this.snapshot();
  }
  beginStreet() {
    const order = [1 - this.dealer, this.dealer];
    this.turns = order.filter(s => this.street === 0 || !this.players[s].fantasy);
    // Fantasyland is committed face down before normal placement begins.
    if (!this.street) this.turns.sort((a, b) => Number(this.players[b].fantasy) - Number(this.players[a].fantasy));
    for (const seat of this.turns) {
      const size = this.players[seat].fantasy ? 13 : this.street ? 1 : 5;
      this.players[seat].pending = this.deck.slice(this.cursor, this.cursor + size); this.cursor += size;
      this.events.push({ type: 'DEAL', seat, street: this.street, cards: [...this.players[seat].pending] });
    }
    this.actor = this.turns[0] ?? null;
  }
  place(seat, placement) {
    if (this.phase !== 'placing' || seat !== this.actor) throw Error('Not this player’s turn');
    const p = this.players[seat];
    if (!Array.isArray(placement) || placement.length !== p.pending.length) throw Error('Place every newly dealt card');
    const cards = placement.map(x => x.card);
    if (new Set(cards).size !== cards.length || cards.some(c => !p.pending.includes(c))) throw Error('Only the current cards can be placed once');
    const rows = clone(p.rows);
    for (const { card, row } of placement) {
      if (!OFC_ROWS[row] || rows[row].length >= OFC_ROWS[row]) throw Error('Row is full or invalid');
      rows[row].push(card);
    }
    p.rows = rows; p.pending = [];
    this.events.push({ type: 'PLACE', seat, street: this.street, placement: clone(placement) });
    this.turns.shift(); this.actor = this.turns[0] ?? null;
    if (this.actor == null) {
      if (this.street === 8 || this.players.every(p => p.fantasy)) this.finish();
      else { this.street++; this.beginStreet(); }
    }
    return this.snapshot();
  }
  suggestPlacement(seat = this.actor) {
    const p = this.players[seat];
    if (!p) return [];
    if (p.fantasy && p.pending.length === 13) {
      const rows = autoArrangeChineseHand(p.pending);
      return Object.keys(OFC_ROWS).flatMap(row => rows[row].map(card => ({ card, row })));
    }
    // A simple CPU heuristic using only its received cards; no future deck or solver.
    const rows = clone(p.rows), result = [];
    for (const card of [...p.pending].sort((a, b) => rank(b) - rank(a))) {
      const candidates = Object.keys(OFC_ROWS).filter(row => rows[row].length < OFC_ROWS[row]);
      const quality = row => {
        const matched = rows[row].filter(c => rank(c) === rank(card)).length;
        const suit = rows[row].filter(c => c.slice(-1) === card.slice(-1)).length;
        return matched * 25 + (row === 'back' ? rank(card) + suit * 3 : row === 'middle' ? 12 - Math.abs(rank(card) - 9) : 15 - rank(card)) - rows[row].length * 2;
      };
      candidates.sort((a, b) => quality(b) - quality(a));
      const row = candidates[0]; rows[row].push(card); result.push({ card, row });
    }
    return result;
  }
  playCpuTurns() { while (this.phase === 'placing' && this.actor === 1) this.place(1, this.suggestPlacement(1)); return this.snapshot(); }
  finish() {
    const evaluations = this.players.map(p => evaluateOfcRows(p.rows));
    const comparison = scoreOfcPair(...evaluations);
    const points = [comparison.total, -comparison.total];
    this.scores = this.scores.map((v, i) => v + points[i]);
    this.result = { evaluations, comparison, points, scores: [...this.scores], nextFantasy: evaluations.map((e, i) => qualifiesForFantasyland(e, this.fantasy[i])) };
    this.phase = 'showdown'; this.actor = null;
  }
  snapshot() { return clone({ handId: this.handId, handNumber: this.handNumber, phase: this.phase, street: this.street, actor: this.actor, dealer: this.dealer, players: this.players, result: this.result, scores: this.scores }); }
  history() {
    if (this.phase !== 'showdown') throw Error('Only completed hands can be exported');
    return clone({ version: 1, variantId: 'ofc', rules: 'classic-13-fantasy-v1', handId: this.handId, handNumber: this.handNumber, initial: this.initial, deck: this.deck, events: this.events, rows: this.players.map(p => p.rows), result: this.result });
  }
}
export function replayOfcHistory(history) {
  try {
    if (history?.variantId !== 'ofc' || history.rules !== 'classic-13-fantasy-v1') throw Error('Unsupported OFC history');
    const c = new OpenFaceChineseController({ deck: history.deck, ...history.initial }); c.startNewHand();
    for (const event of history.events.filter(e => e.type === 'PLACE')) {
      if (event.street !== c.street) throw Error('Street order mismatch');
      c.place(event.seat, event.placement);
    }
    if (c.phase !== 'showdown' || JSON.stringify(c.events) !== JSON.stringify(history.events) || JSON.stringify(c.result) !== JSON.stringify(history.result) || JSON.stringify(c.players.map(p => p.rows)) !== JSON.stringify(history.rows)) throw Error('Replay does not match the recorded hand');
    return { valid: true, snapshot: c.snapshot() };
  } catch (error) { return { valid: false, error: error.message }; }
}
export default OpenFaceChineseController;
