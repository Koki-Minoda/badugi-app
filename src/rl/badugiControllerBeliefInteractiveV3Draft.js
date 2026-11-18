// Candidate-only actor-visible evidence. The published v2 inference path stays unchanged.
import { BadugiControllerInteractiveV2Draft } from './badugiControllerInteractiveV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from './badugiControllerSeatEventViewV2Draft.js';
import { deriveBadugiControllerPublicChipStateV2Draft } from './badugiControllerPublicChipStateV2Draft.js';
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
    raiseAmountBbSum: 0, drawCounts: [0, 0, 0, 0, 0],
    facedBetOpportunities: 0, foldedFacingBet: 0, calledFacingBet: 0,
    raisedFacingBet: 0, freeBetOpportunities: 0, betWhenFree: 0 };
}

function emptyPatResponseCounts() {
  return { opportunities: 0, fold: 0, call: 0, raise: 0 };
}

function emptyPatResponseHistory() {
  return { byStreet: Array.from({ length: 3 }, () => ({
    pat: emptyPatResponseCounts(), draw: emptyPatResponseCounts(),
  })) };
}

function publicActiveSeats(snapshot) {
  return snapshot.players.flatMap((player, seat) =>
    player.stack > 0 && !player.folded && !player.hasFolded &&
    !player.seatOut && !player.sittingOut && !player.isBusted && !player.busted
      ? [seat] : []);
}

function publicActivePlayerCount(snapshot) {
  return publicActiveSeats(snapshot).length;
}

// A response is counted only after a public opponent draw and a legal facing-bet
// decision with exactly two players able to act. The current hand is buffered
// until nextHand(), so these counts cannot reveal a future action.
export function classifyPublicPatResponseOpportunity(decision, snapshot, publicEvents) {
  if (decision.phase !== 'BET' || decision.drawRoundIndex < 1 ||
      decision.drawRoundIndex > 3 || decision.legalMask[0] !== 1 ||
      decision.legalMask[2] !== 1) return null;
  const active = publicActiveSeats(snapshot);
  if (active.length !== 2 || !active.includes(decision.seat)) return null;
  const opponent = active.find((seat) => seat !== decision.seat);
  const draws = publicEvents.filter((event) => event.type === 'DRAW_ACTION' &&
    event.seat === opponent && event.drawRoundIndex === decision.drawRoundIndex - 1);
  if (draws.length !== 1 || !Number.isInteger(draws[0].drawCount) ||
      draws[0].drawCount < 0 || draws[0].drawCount > 4) return null;
  return { seat: decision.seat, street: decision.drawRoundIndex,
    signal: draws[0].drawCount === 0 ? 'pat' : 'draw' };
}

export class BadugiControllerBeliefInteractiveV3Draft extends BadugiControllerInteractiveV2Draft {
  publicBetContext(decision, snapshot) {
    const { currentBet } = deriveBadugiControllerPublicChipStateV2Draft(this.controller, snapshot);
    const actor = snapshot.players[decision.seat];
    return {
      legalActions: decision.legalMask.flatMap((legal, index) => legal && index < 5 ? [index] : []),
      toCallBb: Math.max(0, currentBet - actor.betThisRound) / decision.activeBigBlind,
      potBb: snapshot.players.reduce((total, player) => total + player.totalInvested, 0) /
        decision.activeBigBlind,
      activePlayers: publicActivePlayerCount(snapshot),
    };
  }

  nextHand() {
    this.publicHistory ??= Array.from({ length: this.seatCount }, emptyHistory);
    this.publicPatResponseHistory ??= Array.from({ length: this.seatCount }, emptyPatResponseHistory);
    if (this.handIndex >= 0 && this.complete) {
      const acted = new Set();
      for (const event of this.publicEvents) {
        const history = this.publicHistory[event.seat];
        if (!history) throw new TypeError('belief history requires a valid public seat');
        acted.add(event.seat);
        if (event.type === 'BET_ACTION') {
          history[event.action] += 1;
          if (event.action === 'raise') {
            if (!Number.isFinite(this.currentHandBigBlind) || this.currentHandBigBlind <= 0) {
              throw new TypeError('belief history requires the observed hand blind');
            }
            history.raiseAmountBbSum += event.amount / this.currentHandBigBlind;
          }
        } else if (event.type === 'DRAW_ACTION') {
          history.drawCounts[event.drawCount] += 1;
        }
      }
      for (const seat of acted) this.publicHistory[seat].handsObserved += 1;
      for (const record of this.currentHandDecisionRecords) {
        if (record.phase !== 'BET') continue;
        const history = this.publicHistory[record.seat];
        if (record.legalMask[0] && record.legalMask[2]) {
          history.facedBetOpportunities += 1;
          if (record.actionIndex === 0) history.foldedFacingBet += 1;
          if (record.actionIndex === 2) history.calledFacingBet += 1;
          if (record.actionIndex === 4) history.raisedFacingBet += 1;
        } else if (record.legalMask[1]) {
          history.freeBetOpportunities += 1;
          if (record.actionIndex === 3) history.betWhenFree += 1;
        }
      }
      for (const response of this.currentHandPatResponseRecords) {
        const counts = this.publicPatResponseHistory[response.seat]
          .byStreet[response.street - 1][response.signal];
        counts.opportunities += 1;
        counts[response.action] += 1;
      }
    }
    this.initialActorHands = new Map();
    this.currentHandDecisionRecords = [];
    this.currentHandPatResponseRecords = [];
    this.currentHandBigBlind = null;
    return super.nextHand();
  }

  step(actionIndex) {
    const before = this.currentDecision();
    const snapshot = this.controller.getUiSnapshot(this.state);
    const publicContext = before.phase === 'BET' ? this.publicBetContext(before, snapshot) : null;
    const patResponse = classifyPublicPatResponseOpportunity(before, snapshot, this.publicEvents);
    const result = super.step(actionIndex);
    this.currentHandDecisionRecords.push({ seat: before.seat, phase: before.phase,
      drawRoundIndex: before.drawRoundIndex, legalMask: before.legalMask,
      actionIndex, publicContext });
    if (patResponse) {
      const action = ({ 0: 'fold', 2: 'call', 4: 'raise' })[actionIndex];
      if (!action) throw new TypeError('pat response requires fold, call or raise');
      this.currentHandPatResponseRecords.push({ ...patResponse, action });
    }
    // V2 computes its return decision before this subclass records the previous
    // action. Rebuild it so the external actor sees the complete public context.
    return result.type === 'decision' ? this.currentDecision() : result;
  }

  currentDecision() {
    const decision = super.currentDecision();
    if (this.currentHandBigBlind === null) this.currentHandBigBlind = decision.activeBigBlind;
    if (this.currentHandBigBlind !== decision.activeBigBlind) {
      throw new TypeError('belief history blind changed within a hand');
    }
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
    const publicActions = visible.map((event, index) => {
      const record = this.currentHandDecisionRecords[index];
      if (record && (record.seat !== event.seat ||
          record.drawRoundIndex !== event.drawRoundIndex ||
          record.phase !== (event.type === 'BET_ACTION' ? 'BET' : 'DRAW'))) {
        throw new TypeError('belief public event and decision context diverged');
      }
      return event.type === 'BET_ACTION'
        ? { type: 'BET_ACTION', seat: event.seat, action: event.action.toUpperCase(),
          amountBb: event.amount / decision.activeBigBlind,
          drawRoundIndex: event.drawRoundIndex,
          ...(record?.publicContext ?? {}) }
        : { type: 'DRAW_ACTION', seat: event.seat, drawCount: event.drawCount,
          drawRoundIndex: event.drawRoundIndex };
    });
    return { ...decision, beliefEvidence: {
      actorSeenCards: [...seen.values()], publicActions,
      currentPublicBetContext: decision.phase === 'BET'
        ? this.publicBetContext(decision, snapshot) : null,
      currentPublicDrawContext: decision.phase === 'DRAW'
        ? { activePlayers: publicActivePlayerCount(snapshot) } : null,
      actorHandProgress: { initial, current,
        madeCardGain: current.madeCards - initial.madeCards,
        highRankChange: current.highRank - initial.highRank },
      opponentPublicHistory: this.publicHistory.map((history, index) =>
        index === seat ? null : { ...history, drawCounts: [...history.drawCounts] }),
      opponentPatResponseHistory: this.publicPatResponseHistory.map((history, index) =>
        index === seat ? null : { byStreet: history.byStreet.map((street) => ({
          pat: { ...street.pat }, draw: { ...street.draw },
        })) }),
      // Showdown identities are omitted until a separately audited public reveal exists.
      showdownCardsIncluded: false,
    } };
  }
}
