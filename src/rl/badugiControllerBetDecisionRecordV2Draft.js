// Offline D03 draft. Record a BET decision from the real controller with the
// model's action index and the action the controller actually applied.
// DRAW decisions need a separately audited card replacement path.
import { buildBadugiControllerEventObservationV2Draft } from './badugiControllerEventProjectionV2Draft.js';
import { deriveBadugiControllerPublicChipStateV2Draft } from './badugiControllerPublicChipStateV2Draft.js';

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise'];

function publicChipPlayers(snapshot) {
  return snapshot.players.map((player, seat) => ({
    seat,
    stack: player.stack,
    betThisRound: player.betThisRound,
    totalInvested: player.totalInvested,
    folded: Boolean(player.folded || player.hasFolded),
    allIn: Boolean(player.allIn),
  }));
}

export function applyBadugiControllerBetDecisionV2Draft({
  controller, state, seatIndex, publicEvents, isTournament, actionIndex,
}) {
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex >= ACTIONS.length) {
    throw new TypeError('v2 draft requires a BET action index 0–4');
  }
  const before = controller.getUiSnapshot(state);
  if (before?.phase !== 'BET' || !Array.isArray(before.players)) {
    throw new TypeError('v2 draft requires a controller BET decision');
  }
  const observation = buildBadugiControllerEventObservationV2Draft({
    controller, state, seatIndex, publicEvents, isTournament,
  });
  const legalMask = Array.from(observation.slice(32, 38));
  if (legalMask[actionIndex] !== 1) {
    throw new TypeError('v2 draft rejects an action outside the model legal mask');
  }
  const actorBefore = before.players[seatIndex];
  const { bigBlind, currentBet } = deriveBadugiControllerPublicChipStateV2Draft(controller, before);
  const toCall = Math.max(0, currentBet - actorBefore.betThisRound);
  const unit = before.drawRound >= 2 ? 2 * bigBlind : bigBlind;
  const requestedAction = ACTIONS[actionIndex];
  const payload = { type: actionIndex >= 3 ? 'raise' : requestedAction };
  const result = controller.applyAction(state, { seatIndex, payload });
  if (!result?.state || result.events?.some((event) => event.type === 'invalidAction')) {
    throw new TypeError('v2 draft controller rejected a masked BET action');
  }
  const after = controller.getUiSnapshot(result.state);
  const actorAfter = after.players?.[seatIndex];
  const terminal = controller.isHandFinished(result.state);
  const expectedLabel = actionIndex >= 3 ? 'Raise' :
    requestedAction[0].toUpperCase() + requestedAction.slice(1);
  if (!actorAfter || !terminal && actorAfter.lastAction !== expectedLabel) {
    throw new TypeError(`v2 draft requested ${expectedLabel} but controller applied ${actorAfter?.lastAction}`);
  }
  const amount = actorAfter.totalInvested - actorBefore.totalInvested;
  const expectedAmount = actionIndex === 2 ? Math.min(actorBefore.stack, toCall) :
    actionIndex >= 3 ? toCall + unit : 0;
  if (!Number.isFinite(amount) || amount !== expectedAmount ||
      !terminal && actorAfter.stack !== actorBefore.stack - amount) {
    throw new TypeError(`v2 draft contribution differs: requested=${requestedAction}, ` +
      `amount=${amount}, expected=${expectedAmount}, ` +
      `stack=${actorBefore.stack}->${actorAfter.stack}, ` +
      `round=${before.drawRound}, bb=${bigBlind}, currentBet=${currentBet}`);
  }
  const event = {
    type: 'BET_ACTION', seat: seatIndex,
    drawRoundIndex: before.drawRound, betRoundIndex: before.drawRound,
    action: requestedAction, amount,
    stackBefore: actorBefore.stack, stackAfter: actorAfter.stack,
    betBefore: actorBefore.betThisRound, betAfter: actorAfter.betThisRound,
    potAfter: after.players.reduce((sum, player) => sum + player.totalInvested, 0),
    playersAfter: publicChipPlayers(after),
  };
  return {
    state: result.state, controllerEvents: result.events,
    observation, legalMask, actionIndex, event,
    terminalActionLabelOverwritten: terminal && actorAfter.lastAction !== expectedLabel,
  };
}
