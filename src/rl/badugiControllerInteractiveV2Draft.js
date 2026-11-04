// Isolated real-controller step interface for a future Python policy learner.
// It has no ONNX registry path and does not itself train a model.
import { BadugiGameController } from '../games/badugi/controller/BadugiGameController.js';
import { DeckManager } from '../games/badugi/utils/deck.js';
import { applyBadugiControllerBetDecisionV2Draft } from './badugiControllerBetDecisionRecordV2Draft.js';
import { applyBadugiControllerDrawDecisionV2Draft } from './badugiControllerDrawDecisionRecordV2Draft.js';
import { buildBadugiControllerEventObservationV2Draft } from './badugiControllerEventProjectionV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from './badugiControllerSeatEventViewV2Draft.js';
import { selectBadugiControllerDrawIndexesV2Draft } from './badugiControllerDrawIndexesV2Draft.js';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (values) => values.reduce((total, value) => total + value, 0);

export class BadugiControllerInteractiveV2Draft {
  constructor({ seatCount, occupiedSeatCount = seatCount, isTournament, seed, startingStack = null,
    blindStructure = null }) {
    if (![2, 3, 6].includes(seatCount) || typeof isTournament !== 'boolean' ||
        ![2, 3, 6].includes(occupiedSeatCount) || occupiedSeatCount > seatCount ||
        !Number.isInteger(seed)) {
      throw new TypeError('v2 draft bridge requires 2/3/6 seats, occupied count, mode and seed');
    }
    this.seatCount = seatCount;
    this.occupiedSeatCount = occupiedSeatCount;
    this.isTournament = isTournament;
    this.seed = seed;
    this.blindStructure = blindStructure ?? (isTournament
      ? [{ sb: 5, bb: 10, ante: 0, hands: 1 },
        { sb: 25, bb: 50, ante: 0, hands: 100 }]
      : [{ sb: 10, bb: 20, ante: 0, hands: 999 }]);
    this.startingStack = startingStack ?? (isTournament ? 2000 : 500);
    if (!Number.isInteger(this.startingStack) || this.startingStack <= 0 ||
        !Array.isArray(this.blindStructure) || this.blindStructure.length < 1 ||
        this.blindStructure.some((level) => !Number.isFinite(level.bb) || level.bb <= 0)) {
      throw new TypeError('v2 draft bridge requires stack and blind structure');
    }
    const seatConfig = Array.from({ length: seatCount }, (_, seat) =>
      seat < occupiedSeatCount ? 'CPU' : 'EMPTY');
    this.controller = new BadugiGameController({
      seatConfig, startingStack: this.startingStack,
      blindStructure: this.blindStructure,
      lastStructureIndex: this.blindStructure.length - 1,
    });
    this.state = this.controller.createInitialState({ seatConfig });
    this.handIndex = -1;
    this.complete = true;
  }

  nextHand() {
    if (!this.complete) throw new TypeError('v2 draft bridge hand is still running');
    this.handIndex += 1;
    this.startingStacks = this.handIndex === 0
      ? Array.from({ length: this.seatCount }, (_, seat) =>
        seat < this.occupiedSeatCount ? this.startingStack : 0)
      : this.endingStacks;
    this.deck = new DeckManager({ rng: seededRandom(this.seed + this.handIndex * 1009) });
    this.state = this.controller.createNewHandState(this.state, {
      ...(this.isTournament && this.handIndex === 0 && this.blindStructure.length > 1
        ? { blindState: { blindLevelIndex: 1, handsInLevel: 1 } } : {}),
      drawCardsForSeat: () => this.deck.draw(4),
    });
    this.publicEvents = [];
    this.actorDrawEvents = Array.from({ length: this.seatCount }, () => []);
    this.decisionCount = 0;
    this.complete = this.controller.isHandFinished(this.state);
    return this.complete ? this.handResult() : this.currentDecision();
  }

  currentDecision() {
    if (this.complete) throw new TypeError('v2 draft bridge has no active decision');
    const snapshot = this.controller.getUiSnapshot(this.state);
    const seat = snapshot.turn ?? snapshot.nextTurn;
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.seatCount ||
        !['BET', 'DRAW'].includes(snapshot.phase)) {
      throw new TypeError('v2 draft bridge has invalid controller turn');
    }
    const events = buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: this.publicEvents,
      actorDrawEvents: this.actorDrawEvents[seat], seatIndex: seat,
    });
    const observation = buildBadugiControllerEventObservationV2Draft({
      controller: this.controller, state: this.state, seatIndex: seat,
      publicEvents: events, isTournament: this.isTournament,
    });
    return { type: 'decision', schemaVersion: 'badugi-controller-observation-v2-draft',
      seatCount: this.seatCount, isTournament: this.isTournament,
      occupiedSeatCount: this.occupiedSeatCount,
      handIndex: this.handIndex, decisionIndex: this.decisionCount,
      seat, phase: snapshot.phase, drawRoundIndex: snapshot.drawRound,
      eligibleSeats: snapshot.players.flatMap((player, index) =>
        player.stack > 0 && !(player.seatOut || player.sittingOut ||
          player.isBusted || player.busted) ? [index] : []),
      observation: Array.from(observation),
      legalMask: Array.from(observation.slice(32, 38)),
      activeBigBlind: this.blindStructure[snapshot.blindLevelIndex].bb };
  }

  step(actionIndex) {
    const decision = this.currentDecision();
    if (!Number.isInteger(actionIndex) || decision.legalMask[actionIndex] !== 1) {
      throw new TypeError('v2 draft bridge rejects an unmasked action');
    }
    const seat = decision.seat;
    const events = buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: this.publicEvents,
      actorDrawEvents: this.actorDrawEvents[seat], seatIndex: seat,
    });
    let record;
    if (decision.phase === 'BET') {
      record = applyBadugiControllerBetDecisionV2Draft({
        controller: this.controller, state: this.state, seatIndex: seat,
        publicEvents: events, isTournament: this.isTournament, actionIndex,
      });
      this.publicEvents.push(record.event);
    } else {
      const snapshot = this.controller.getUiSnapshot(this.state);
      const actorHand = snapshot.players[seat].hand;
      const drawIndexes = selectBadugiControllerDrawIndexesV2Draft(actorHand, actionIndex);
      const activeCards = snapshot.players.flatMap((player) => player.hand ?? []);
      const newCards = this.deck.draw(actionIndex, { activeCards });
      if (newCards.length !== actionIndex) throw new TypeError('v2 draft bridge deck exhausted');
      const replacedCards = drawIndexes.map((index, offset) => ({
        index, oldCard: actorHand[index], newCard: newCards[offset],
      }));
      this.deck.discard(replacedCards.map((entry) => entry.oldCard));
      const handAfter = [...actorHand];
      for (const replacement of replacedCards) handAfter[replacement.index] = replacement.newCard;
      record = applyBadugiControllerDrawDecisionV2Draft({
        controller: this.controller, state: this.state, seatIndex: seat,
        observationEvents: events, isTournament: this.isTournament,
        actionIndex, drawIndexes, replacedCards, handAfter,
      });
      this.publicEvents.push(record.publicEvent);
      this.actorDrawEvents[seat].push(record.actorProjectionEvent);
    }
    this.state = record.state;
    this.decisionCount += 1;
    if (this.decisionCount > 200) throw new TypeError('v2 draft bridge hand exceeded 200 decisions');
    this.complete = this.controller.isHandFinished(this.state);
    if (this.complete) return this.handResult();
    const snapshot = this.controller.getUiSnapshot(this.state);
    const accounted = sum(snapshot.players.map((player) => player.stack + player.totalInvested));
    if (accounted !== sum(this.startingStacks)) {
      throw new TypeError('v2 draft bridge lost or created chips');
    }
    return this.currentDecision();
  }

  handResult() {
    const snapshot = this.controller.getUiSnapshot(this.state);
    this.endingStacks = snapshot.players.map((player) => player.stack);
    if (sum(this.startingStacks) !== sum(this.endingStacks)) {
      throw new TypeError('v2 draft bridge terminal chips do not balance');
    }
    return { type: 'hand_end', handIndex: this.handIndex,
      startingStacks: this.startingStacks, endingStacks: this.endingStacks,
      chipDeltaBySeat: this.endingStacks.map((value, seat) => value - this.startingStacks[seat]),
      decisionCount: this.decisionCount };
  }
}
