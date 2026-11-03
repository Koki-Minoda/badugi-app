// D03 proposal only. Do not route a published model through this encoder.
// The caller supplies public controller state plus the acting player's cards.
export const BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT = 'badugi-controller-observation-v2-draft';
export const BADUGI_CONTROLLER_OBSERVATION_V2_SIZE = 96;

const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ratio = (value, limit) => clamp01(value / limit);

function cardTuple(card) {
  const match = typeof card === 'string'
    ? card.trim().toUpperCase().match(/^([2-9]|10|[AJQK])([CDHS])$/)
    : null;
  if (!match) throw new TypeError('v2 draft requires valid acting-player cards');
  return [RANKS.indexOf(match[1] === '10' ? 'T' : match[1]), SUITS.indexOf(match[2])];
}

function requireNumber(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`v2 draft requires ${name}`);
}

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`v2 draft requires ${name}`);
}

function bestBadugiRanks(cards) {
  let best = [];
  for (let mask = 1; mask < 16; mask += 1) {
    const subset = cards.filter((_, index) => mask & (1 << index));
    const ranks = subset.map(([rank]) => rank);
    const suits = subset.map(([, suit]) => suit);
    if (new Set(ranks).size !== subset.length || new Set(suits).size !== subset.length) continue;
    const sorted = [...ranks].sort((a, b) => a - b);
    let lowerRanks = false;
    if (sorted.length === best.length) {
      for (let index = sorted.length - 1; index >= 0; index -= 1) {
        if (sorted[index] === best[index]) continue;
        lowerRanks = sorted[index] < best[index];
        break;
      }
    }
    if (sorted.length > best.length || lowerRanks) {
      best = sorted;
    }
  }
  return best;
}

export const BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS = Object.freeze([
  ...Array.from({ length: 4 }, (_, index) => [`own_card_${index}_rank_over_12`, `own_card_${index}_suit_over_3`]).flat(),
  'phase_draw', 'draw_round_over_3', 'table_size_over_6', 'in_hand_count_over_6',
  'button_relative_position', 'is_button', 'own_stack_bb_over_200', 'pot_bb_over_400',
  'own_round_bet_bb_over_20', 'current_bet_bb_over_20', 'to_call_bb_over_20',
  'fixed_bet_unit_bb_over_2', 'raise_count_over_4', 'is_tournament', 'first_to_act',
  'effective_stack_bb_over_200', 'best_badugi_count_over_4', 'best_high_rank_over_12',
  'best_rank_sum_over_40', 'duplicate_rank_count_over_3', 'duplicate_suit_count_over_3',
  'made_four_card_badugi', 'own_last_draw_count_over_4', 'draws_remaining_over_3',
  ...Array.from({ length: 6 }, (_, index) => `legal_action_${index}`),
  ...Array.from({ length: 3 }, (_, index) => `own_bet_history_round_${index}`),
  ...Array.from({ length: 3 }, (_, index) => `own_draw_history_round_${index}_over_4`),
  ...Array.from({ length: 5 }, (_, opponent) => [
    'occupied', 'in_hand', 'all_in', 'stack_bb_over_200', 'round_bet_bb_over_20',
    'last_draw_known', 'last_draw_count_over_4', 'opened_current_round',
    'prior_aggression', 'cumulative_draw_count_over_12',
  ].map((name) => `relative_opponent_${opponent + 1}_${name}`)).flat(),
  'own_discarded_aces_over_4', 'own_discarded_2_to_5_over_16',
]);

if (BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS.length !== BADUGI_CONTROLLER_OBSERVATION_V2_SIZE) {
  throw new Error('v2 draft slot manifest must contain exactly 96 entries');
}

function legalMask({ phase, controllerLegalActions, currentBet, toCall, stack, unit }) {
  if (!Array.isArray(controllerLegalActions) ||
      controllerLegalActions.some((action) => typeof action !== 'string')) {
    throw new TypeError('v2 draft requires controller legal action names');
  }
  const legal = new Set(controllerLegalActions.map((action) => action.toUpperCase()));
  if (phase === 'DRAW') return [0, 1, 2, 3, 4].map(() => Number(legal.has('DRAW'))).concat(0);
  return [
    Number(toCall > 0 && legal.has('FOLD')),
    Number(toCall === 0 && legal.has('CHECK')),
    Number(toCall > 0 && stack > 0 && legal.has('CALL')),
    Number(currentBet === 0 && stack >= unit && legal.has('RAISE')),
    Number(currentBet > 0 && stack >= toCall + unit && legal.has('RAISE')),
    0, // The controller does not advertise a discretionary ALL_IN action.
  ];
}

/**
 * This is the one proposed numeric encoder for future controller rollouts and
 * browser inference. The public-event projection and independent auditor are
 * separate work; no historical ONNX weights are compatible by assumption.
 */
export function buildBadugiControllerObservationV2Draft(input) {
  if (input?.schemaVersion !== BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT) {
    throw new TypeError('v2 draft schema version required');
  }
  const { players, seatIndex, dealerIndex, phase, drawRoundIndex, bigBlind,
    currentBet, pot, raiseCount, firstToAct, isTournament, controllerLegalActions,
    ownCards, ownDiscardedCards, ownBetHistory, ownDrawHistory } = input;
  if (!Array.isArray(players) || ![2, 3, 6].includes(players.length) ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= players.length ||
      !Number.isInteger(dealerIndex) || dealerIndex < 0 || dealerIndex >= players.length ||
      !['BET', 'DRAW'].includes(phase) || !Number.isInteger(drawRoundIndex) ||
      drawRoundIndex < 0 || drawRoundIndex > 3 ||
      (phase === 'DRAW' && drawRoundIndex > 2)) {
    throw new TypeError('v2 draft requires a 2/3/6-seat decision');
  }
  for (const [name, value] of Object.entries({ bigBlind, currentBet, pot, raiseCount })) {
    requireNumber(value, name);
  }
  if (bigBlind === 0 || !Number.isInteger(raiseCount) || raiseCount > 4) {
    throw new TypeError('v2 draft requires valid blind and raise count');
  }
  requireBoolean(firstToAct, 'firstToAct');
  requireBoolean(isTournament, 'isTournament');
  if (!Array.isArray(ownCards) || ownCards.length !== 4 ||
      !Array.isArray(ownDiscardedCards) ||
      !Array.isArray(ownBetHistory) || ownBetHistory.length !== 3 ||
      !ownBetHistory.every((value) => typeof value === 'boolean') ||
      !Array.isArray(ownDrawHistory) || ownDrawHistory.length !== 3 ||
      !ownDrawHistory.every((value) => Number.isInteger(value) && value >= 0 && value <= 4)) {
    throw new TypeError('v2 draft requires complete acting-player history');
  }
  for (let round = 0; round < 3; round += 1) {
    const betRoundComplete = round < drawRoundIndex ||
      (phase === 'DRAW' && round === drawRoundIndex);
    if (!betRoundComplete && ownBetHistory[round]) {
      throw new TypeError('v2 draft rejects future acting-player bet history');
    }
    if (round >= drawRoundIndex && ownDrawHistory[round] !== 0) {
      throw new TypeError('v2 draft rejects future acting-player draw history');
    }
  }
  const cards = ownCards.map(cardTuple).sort(([rankA, suitA], [rankB, suitB]) =>
    rankA - rankB || suitA - suitB);
  if (new Set(cards.map(([rank, suit]) => `${rank}:${suit}`)).size !== 4) {
    throw new TypeError('v2 draft requires four distinct acting-player cards');
  }
  const discarded = ownDiscardedCards.map(cardTuple);
  for (const player of players) {
    if (!player) throw new TypeError('v2 draft requires all seat records');
    for (const [name, value] of Object.entries({ stack: player.stack,
      betThisRound: player.betThisRound })) requireNumber(value, name);
    for (const name of ['occupied', 'inHand', 'allIn', 'lastDrawKnown',
      'openedCurrentRound', 'priorAggression']) requireBoolean(player[name], name);
    for (const [name, value] of Object.entries({ lastDrawCount: player.lastDrawCount,
      cumulativeDrawCount: player.cumulativeDrawCount })) requireNumber(value, name);
    if (!Number.isInteger(player.lastDrawCount) || player.lastDrawCount > 4 ||
        !Number.isInteger(player.cumulativeDrawCount) || player.cumulativeDrawCount > 12) {
      throw new TypeError('v2 draft requires valid public draw counts');
    }
    if (!player.lastDrawKnown && player.lastDrawCount !== 0) {
      throw new TypeError('v2 draft rejects non-public draw counts');
    }
  }
  const hero = players[seatIndex];
  if (!hero.occupied || !hero.inHand || hero.allIn && phase === 'BET') {
    throw new TypeError('v2 draft requires an actionable acting player');
  }
  const current = phase === 'BET' ? currentBet : 0;
  const toCall = Math.max(0, current - hero.betThisRound);
  const unit = drawRoundIndex >= 2 ? 2 * bigBlind : bigBlind;
  const mask = legalMask({ phase, controllerLegalActions, currentBet: current,
    toCall, stack: hero.stack, unit });
  if (!mask.some(Boolean)) throw new TypeError('v2 draft requires a legal model action');
  const best = bestBadugiRanks(cards);
  const ranks = cards.map(([rank]) => rank);
  const suits = cards.map(([, suit]) => suit);
  const lastDrawCount = drawRoundIndex > 0 ? ownDrawHistory[drawRoundIndex - 1] : 0;
  const activeOpponentStacks = players.filter((player, index) =>
    index !== seatIndex && player.inHand).map((player) => player.stack);
  const effectiveStack = Math.min(hero.stack, Math.max(0, ...activeOpponentStacks));
  const values = [];
  for (const [rank, suit] of cards) values.push(rank / 12, suit / 3);
  values.push(Number(phase === 'DRAW'), drawRoundIndex / 3, players.length / 6,
    players.filter((player) => player.inHand).length / 6,
    ((seatIndex - dealerIndex - 1 + players.length) % players.length) / (players.length - 1),
    Number(seatIndex === dealerIndex), ratio(hero.stack / bigBlind, 200),
    ratio(pot / bigBlind, 400), ratio(hero.betThisRound / bigBlind, 20),
    ratio(current / bigBlind, 20), ratio(toCall / bigBlind, 20),
    unit / bigBlind / 2, raiseCount / 4, Number(isTournament), Number(firstToAct),
    ratio(effectiveStack / bigBlind, 200));
  values.push(best.length / 4, best[best.length - 1] / 12,
    ratio(best.reduce((sum, rank) => sum + rank, 0), 40),
    ratio(4 - new Set(ranks).size, 3), ratio(4 - new Set(suits).size, 3),
    Number(best.length === 4), lastDrawCount / 4, (3 - drawRoundIndex) / 3);
  values.push(...mask, ...ownBetHistory.map(Number), ...ownDrawHistory.map((value) => value / 4));
  for (let offset = 1; offset <= 5; offset += 1) {
    const opponent = offset < players.length ? players[(seatIndex + offset) % players.length] : null;
    if (!opponent) {
      values.push(...Array(10).fill(0));
      continue;
    }
    values.push(Number(opponent.occupied), Number(opponent.inHand), Number(opponent.allIn),
      ratio(opponent.stack / bigBlind, 200), ratio(opponent.betThisRound / bigBlind, 20),
      Number(opponent.lastDrawKnown), opponent.lastDrawKnown ? opponent.lastDrawCount / 4 : 0,
      Number(opponent.openedCurrentRound), Number(opponent.priorAggression),
      ratio(opponent.cumulativeDrawCount, 12));
  }
  values.push(ratio(discarded.filter(([rank]) => rank === 0).length, 4),
    ratio(discarded.filter(([rank]) => rank >= 1 && rank <= 4).length, 16));
  if (values.length !== BADUGI_CONTROLLER_OBSERVATION_V2_SIZE ||
      values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError('v2 draft produced an invalid observation');
  }
  return Float32Array.from(values);
}
