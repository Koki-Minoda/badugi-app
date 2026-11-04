// Offline D03 draft. Collect real-controller hand decisions without routing
// any published ONNX model. The fixed policy here is a wiring probe only.
import { BadugiGameController } from '../games/badugi/controller/BadugiGameController.js';
import { DeckManager } from '../games/badugi/utils/deck.js';
import { applyBadugiControllerBetDecisionV2Draft } from './badugiControllerBetDecisionRecordV2Draft.js';
import { applyBadugiControllerDrawDecisionV2Draft } from './badugiControllerDrawDecisionRecordV2Draft.js';
import { buildBadugiControllerEventObservationV2Draft } from './badugiControllerEventProjectionV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from './badugiControllerSeatEventViewV2Draft.js';

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

function stacks(snapshot) {
  return snapshot.players.map((player) => player.stack);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function captureAuditInput({ controller, state, snapshot, seatIndex,
  publicEvents, actorDrawEvents }) {
  return {
    seatIndex, phase: snapshot.phase, drawRoundIndex: snapshot.drawRound,
    dealerIndex: snapshot.dealerIdx, blindLevelIndex: snapshot.blindLevelIndex,
    raiseCount: snapshot.raiseCountThisRound,
    blindStructure: controller.config.blindStructure.map((level) => ({ bb: level.bb })),
    controllerLegalActions: controller.getLegalActions(state, seatIndex).map((action) => action.type),
    publicEvents: publicEvents.map((event) => ({
      type: event.type, seat: event.seat,
      drawRoundIndex: event.drawRoundIndex, betRoundIndex: event.betRoundIndex,
      ...(event.type === 'BET_ACTION' ? { action: event.action } : { drawCount: event.drawCount }),
    })),
    actorDrawEvents: actorDrawEvents.map((event) => ({
      seat: event.seat, drawRoundIndex: event.drawRoundIndex,
      drawCount: event.drawCount,
      replacedCards: event.replacedCards.map((card) => ({ oldCard: card.oldCard })),
    })),
    players: snapshot.players.map((player, index) => ({
      stack: player.stack, betThisRound: player.betThisRound,
      totalInvested: player.totalInvested,
      seatOut: Boolean(player.seatOut), sittingOut: Boolean(player.sittingOut),
      isBusted: Boolean(player.isBusted), busted: Boolean(player.busted),
      folded: Boolean(player.folded), hasFolded: Boolean(player.hasFolded),
      allIn: Boolean(player.allIn), lastDrawCount: player.lastDrawCount,
      ...(index === seatIndex ? { hand: [...player.hand] } : {}),
    })),
  };
}

export function collectBadugiControllerRolloutV2Draft({
  seatCount, occupiedSeatCount = seatCount, isTournament, hands, seed,
  includeAuditInputs = false,
}) {
  if (![2, 3, 6].includes(seatCount) || typeof isTournament !== 'boolean' ||
      ![2, 3, 6].includes(occupiedSeatCount) || occupiedSeatCount > seatCount ||
      !Number.isInteger(hands) || hands < 1 || hands > 100 ||
      !Number.isInteger(seed) || typeof includeAuditInputs !== 'boolean') {
    throw new TypeError('v2 draft requires 2/3/6 seats, mode, hands and seed');
  }
  const seatConfig = Array.from({ length: seatCount }, (_, seat) =>
    seat < occupiedSeatCount ? 'CPU' : 'EMPTY');
  const blindStructure = isTournament
    ? [{ sb: 5, bb: 10, ante: 0, hands: 1 },
      { sb: 25, bb: 50, ante: 0, hands: 100 }]
    : [{ sb: 10, bb: 20, ante: 0, hands: 999 }];
  const startingStack = isTournament ? 2000 : 500;
  const controller = new BadugiGameController({
    seatConfig, startingStack, blindStructure,
    lastStructureIndex: blindStructure.length - 1,
  });
  let state = controller.createInitialState({ seatConfig });
  const results = [];
  for (let handIndex = 0; handIndex < hands; handIndex += 1) {
    const startingStacks = handIndex === 0
      ? Array.from({ length: seatCount }, (_, seat) =>
        seat < occupiedSeatCount ? startingStack : 0)
      : results[handIndex - 1].endingStacks;
    const deck = new DeckManager({ rng: seededRandom(seed + handIndex * 1009) });
    state = controller.createNewHandState(state, {
      ...(isTournament && handIndex === 0
        ? { blindState: { blindLevelIndex: 1, handsInLevel: 1 } } : {}),
      drawCardsForSeat: () => deck.draw(4),
    });
    const publicEvents = [];
    const actorDrawEvents = Array.from({ length: seatCount }, () => []);
    const decisions = [];
    for (let step = 0; step < 200 && !controller.isHandFinished(state); step += 1) {
      const snapshot = controller.getUiSnapshot(state);
      const seatIndex = snapshot.turn ?? snapshot.nextTurn;
      if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= seatCount) {
        throw new TypeError('v2 draft rollout has no actionable controller seat');
      }
      const auditInput = includeAuditInputs ? captureAuditInput({
        controller, state, snapshot, seatIndex,
        publicEvents, actorDrawEvents: actorDrawEvents[seatIndex],
      }) : null;
      const observationEvents = buildBadugiControllerSeatEventViewV2Draft({
        publicEvents, actorDrawEvents: actorDrawEvents[seatIndex], seatIndex,
      });
      const observation = buildBadugiControllerEventObservationV2Draft({
        controller, state, seatIndex, publicEvents: observationEvents, isTournament,
      });
      let record;
      if (snapshot.phase === 'BET') {
        const legalMask = observation.slice(32, 38);
        const actionIndex = step === 0 && legalMask[4] ? 4 :
          legalMask[1] ? 1 : legalMask[2] ? 2 :
            legalMask[3] ? 3 : legalMask[4] ? 4 : 0;
        record = applyBadugiControllerBetDecisionV2Draft({
          controller, state, seatIndex, publicEvents: observationEvents,
          isTournament, actionIndex,
        });
        publicEvents.push(record.event);
      } else if (snapshot.phase === 'DRAW') {
        const oldCard = snapshot.players[seatIndex].hand[0];
        const activeCards = snapshot.players.flatMap((player) => player.hand ?? []);
        const newCard = deck.draw(1, { activeCards })[0];
        if (!newCard) throw new TypeError('v2 draft rollout deck exhausted');
        deck.discard([oldCard]);
        const handAfter = [...snapshot.players[seatIndex].hand];
        handAfter[0] = newCard;
        record = applyBadugiControllerDrawDecisionV2Draft({
          controller, state, seatIndex, observationEvents, isTournament,
          actionIndex: 1, drawIndexes: [0],
          replacedCards: [{ index: 0, oldCard, newCard }], handAfter,
        });
        publicEvents.push(record.publicEvent);
        actorDrawEvents[seatIndex].push(record.actorProjectionEvent);
      } else {
        throw new TypeError('v2 draft rollout reached an unexpected phase');
      }
      decisions.push({
        seat: seatIndex, phase: snapshot.phase, drawRoundIndex: snapshot.drawRound,
        observation: Array.from(record.observation),
        legalMask: record.legalMask, actionIndex: record.actionIndex,
        appliedEvent: record.event ?? record.publicEvent,
        policySource: 'deterministic-wiring-probe',
        ...(includeAuditInputs ? { auditInput } : {}),
      });
      state = record.state;
      if (!controller.isHandFinished(state)) {
        const live = controller.getUiSnapshot(state).players;
        const accounted = sum(live.map((player) =>
          player.stack + player.totalInvested));
        if (accounted !== sum(startingStacks)) {
          throw new TypeError('v2 draft rollout lost or created chips before showdown');
        }
      }
    }
    if (!controller.isHandFinished(state)) {
      throw new TypeError('v2 draft rollout did not finish within 200 decisions');
    }
    const endingStacks = stacks(controller.getUiSnapshot(state));
    if (sum(startingStacks) !== sum(endingStacks)) {
      throw new TypeError(`v2 draft rollout chip mismatch: ` +
        `start=${startingStacks.join(',')}, end=${endingStacks.join(',')}, ` +
        `invested=${controller.getUiSnapshot(state).players.map((player) => player.totalInvested).join(',')}`);
    }
    results.push({
      handIndex, startingStacks, endingStacks,
      chipDeltaBySeat: endingStacks.map((value, seat) => value - startingStacks[seat]),
      decisions, publicEvents,
    });
  }
  return {
    schemaVersion: 'badugi-controller-rollout-v2-draft',
    observationSchemaVersion: 'badugi-controller-observation-v2-draft',
    policySource: 'deterministic-wiring-probe',
    seatCount, occupiedSeatCount, isTournament, seed, hands: results,
  };
}
