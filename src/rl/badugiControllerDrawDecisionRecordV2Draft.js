// Offline D03 draft. The live deck supplies replacements. Keep their card
// identities in an actor-only event; the public event contains counts only.
import { buildBadugiControllerEventObservationV2Draft } from './badugiControllerEventProjectionV2Draft.js';

function canonicalCard(card) {
  const normalized = typeof card === 'string' ? card.trim().toUpperCase() : '';
  if (!/^(10|[2-9TAJQK])[CDHS]$/.test(normalized)) {
    throw new TypeError('v2 draft requires valid replacement cards');
  }
  return normalized.replace(/^10/, 'T');
}

function validateReplacement(beforeHand, drawIndexes, replacedCards, handAfter) {
  if (!Array.isArray(drawIndexes) || !Array.isArray(replacedCards) ||
      !Array.isArray(handAfter) || handAfter.length !== 4 ||
      drawIndexes.length !== replacedCards.length ||
      new Set(drawIndexes).size !== drawIndexes.length ||
      drawIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= 4)) {
    throw new TypeError('v2 draft requires complete, unique DRAW replacements');
  }
  const expected = [...beforeHand];
  for (const [offset, index] of drawIndexes.entries()) {
    const replacement = replacedCards[offset];
    if (replacement?.index !== index || replacement.oldCard !== beforeHand[index] ||
        canonicalCard(replacement.newCard) === canonicalCard(beforeHand[index])) {
      throw new TypeError('v2 draft DRAW replacement differs from the actor hand');
    }
    expected[index] = replacement.newCard;
  }
  if (new Set(expected.map(canonicalCard)).size !== 4 ||
      expected.some((card, index) => card !== handAfter[index])) {
    throw new TypeError('v2 draft DRAW handAfter differs from replacements');
  }
}

export function applyBadugiControllerDrawDecisionV2Draft({
  controller, state, seatIndex, observationEvents, isTournament,
  actionIndex, drawIndexes, replacedCards, handAfter,
}) {
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex > 4) {
    throw new TypeError('v2 draft requires a DRAW action index 0–4');
  }
  const before = controller.getUiSnapshot(state);
  if (before?.phase !== 'DRAW' || !Array.isArray(before.players)) {
    throw new TypeError('v2 draft requires a controller DRAW decision');
  }
  const observation = buildBadugiControllerEventObservationV2Draft({
    controller, state, seatIndex, publicEvents: observationEvents, isTournament,
  });
  const legalMask = Array.from(observation.slice(32, 38));
  if (legalMask[actionIndex] !== 1 || drawIndexes?.length !== actionIndex) {
    throw new TypeError('v2 draft rejects a DRAW outside the model legal mask');
  }
  const actorBefore = before.players[seatIndex];
  validateReplacement(actorBefore.hand, drawIndexes, replacedCards, handAfter);
  const result = controller.applyAction(state, {
    seatIndex,
    payload: { type: 'draw', drawIndexes, drawCount: actionIndex,
      replacedCards, handAfter },
  });
  if (!result?.state || result.events?.some((event) => event.type === 'invalidAction')) {
    throw new TypeError('v2 draft controller rejected a masked DRAW action');
  }
  const after = controller.getUiSnapshot(result.state);
  const actorAfter = after.players?.[seatIndex];
  const terminal = controller.isHandFinished(result.state);
  const expectedLabel = actionIndex === 0 ? 'Pat' : `DRAW(${actionIndex})`;
  if (!actorAfter || actorAfter.lastDrawCount !== actionIndex ||
      !terminal && actorAfter.lastAction !== expectedLabel ||
      actorAfter.hand.some((card, index) => card !== handAfter[index]) ||
      !terminal && actorAfter.stack !== actorBefore.stack ||
      actorAfter.totalInvested !== actorBefore.totalInvested) {
    throw new TypeError(`v2 draft applied DRAW differs from replacement record: ` +
      `seat=${seatIndex}, round=${before.drawRound}, requested=${actionIndex}, ` +
      `lastDraw=${actorAfter?.lastDrawCount}, lastAction=${actorAfter?.lastAction}, ` +
      `hand=${actorAfter?.hand?.join(',')}, expected=${handAfter.join(',')}, ` +
      `stack=${actorBefore.stack}->${actorAfter?.stack}, ` +
      `invested=${actorBefore.totalInvested}->${actorAfter?.totalInvested}`);
  }
  const publicEvent = {
    type: 'DRAW_ACTION', seat: seatIndex,
    drawRoundIndex: before.drawRound, betRoundIndex: before.drawRound,
    drawCount: actionIndex,
    stackBefore: actorBefore.stack, stackAfter: actorAfter.stack,
    potAfter: after.players.reduce((sum, player) => sum + player.totalInvested, 0),
    playersAfter: after.players.map((player, seat) => ({
      seat, stack: player.stack, betThisRound: player.betThisRound,
      totalInvested: player.totalInvested,
      folded: Boolean(player.folded || player.hasFolded), allIn: Boolean(player.allIn),
    })),
  };
  return {
    state: result.state, controllerEvents: result.events,
    observation, legalMask, actionIndex, publicEvent,
    terminalActionLabelOverwritten: terminal && actorAfter.lastAction !== expectedLabel,
    actorProjectionEvent: { ...publicEvent,
      replacedCards: replacedCards.map((entry) => ({ ...entry })) },
  };
}
