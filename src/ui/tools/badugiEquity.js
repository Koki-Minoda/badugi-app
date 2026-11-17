import { compareBadugiEvaluations, evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';
import { calledBetValue } from '../personalResults/finalBetValue.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';

const deck = new Map(PRACTICE_CARDS.map((card, index) => [card, index]));
const trials = 10_000;

function normalizeCard(card) {
  if (typeof card !== 'string') return null;
  const normalized = card.trim().toUpperCase().replace(/^T/, '10');
  return deck.get(normalized) ?? null;
}

export const MAX_RANGE_HANDS = 24;

export function parseBadugiRange(text) {
  if (typeof text !== 'string') return { error: 'rangeEmpty' };
  const candidates = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    if (candidates.length === MAX_RANGE_HANDS) return { error: 'rangeLimit' };
    const tokens = line.trim().replaceAll('♠', 'S').replaceAll('♥', 'H').replaceAll('♦', 'D').replaceAll('♣', 'C').split(/[\s,]+/);
    const cards = tokens.slice(0, 4).map(normalizeCard);
    const weight = tokens.length === 4 ? 1 : Number(tokens[4]);
    if (cards.length !== 4 || cards.includes(null) || new Set(cards).size !== 4 || tokens.length > 5 || !(weight > 0 && weight <= 1_000_000)) {
      return { error: 'rangeLine', line: index + 1 };
    }
    candidates.push({ cards: cards.map(id => PRACTICE_CARDS[id]), weight });
  }
  return candidates.length ? { candidates } : { error: 'rangeEmpty' };
}

function prepare({ hands, remainingDraws, deadCards = [] }) {
  if (!Number.isInteger(remainingDraws) || remainingDraws < 0 || remainingDraws > 3) return { error: 'drawRounds' };
  if (!Array.isArray(hands) || hands.length !== 2 || Array.from(hands).some(hand => !Array.isArray(hand) || hand.length !== 4)) {
    return { error: 'handSize' };
  }
  if (!Array.isArray(deadCards)) return { error: 'card' };
  const normalizedHands = hands.map(hand => Array.from(hand, normalizeCard));
  const known = [...normalizedHands.flat(), ...Array.from(deadCards, normalizeCard)];
  if (known.includes(null)) return { error: 'card' };
  const used = new Set(known);
  if (used.size !== known.length) return { error: 'duplicate' };

  const available = PRACTICE_CARDS.map((_, index) => index).filter(index => !used.has(index));
  return { hands: normalizedHands, available, remainingDraws, evaluations: new Map() };
}

export function badugiDiscardOptions(hand) {
  return Array.from({ length: 1 << hand.length }, (_, mask) => hand.filter((_, index) => mask & (1 << index)));
}

function evaluateIds(cards) {
  return evaluateBadugi(cards.map(index => PRACTICE_CARDS[index]));
}

function assumeDiscards(hand, count) {
  // Table order breaks ties consistently across equivalent input permutations.
  const ordered = [...hand].sort((a, b) => a - b);
  let selected;
  let strongest;
  for (const discard of badugiDiscardOptions(ordered)) {
    if (discard.length !== count) continue;
    const evaluation = evaluateIds(ordered.filter(card => !discard.includes(card)));
    if (!strongest || compareBadugiEvaluations(evaluation, strongest) < 0) {
      strongest = evaluation;
      selected = discard;
    }
  }
  return selected;
}

function rankHand(cards, cache) {
  const [a, b, c, d] = [...cards].sort((left, right) => left - right);
  const key = ((a * 52 + b) * 52 + c) * 52 + d;
  let hand = cache.get(key);
  if (!hand) {
    const evaluation = evaluateIds(cards);
    // Smaller scores win: compare hand size, then highest ranks first.
    const score = evaluation.ranks.reduceRight((value, rank) => value * 16 + rank, 0)
      + (4 - evaluation.count) * 65_536;
    hand = { key, score, size: evaluation.count, high: evaluation.kicker, keep: evaluation.activeCards.map(card => deck.get(card)) };
    cache.set(key, hand);
  }
  return hand;
}

function summarize(wins, ties, losses, availableCards, method) {
  const outcomes = wins + ties + losses;
  return {
    method,
    outcomes,
    availableCards,
    players: [
      { wins, ties, losses, equity: (wins + ties / 2) / outcomes },
      { wins: losses, ties, losses: wins, equity: (losses + ties / 2) / outcomes },
    ],
  };
}

function exactShowdown(hands, kept, counts, available, cache, observe) {
  const handsByReplacement = kept.map((cards, seat) => counts[seat]
    ? available.map(card => rankHand([...cards, card], cache))
    : [rankHand(hands[seat], cache)]);
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let a = 0; a < handsByReplacement[0].length; a += 1) {
    for (let b = 0; b < handsByReplacement[1].length; b += 1) {
      if (counts[0] && counts[1] && a === b) continue;
      const left = handsByReplacement[0][a];
      const right = handsByReplacement[1][b];
      const delta = left.score - right.score;
      observe?.(left, right, delta < 0 ? 1 : delta === 0 ? 0.5 : 0);
      if (delta < 0) wins += 1;
      else if (delta > 0) losses += 1;
      else ties += 1;
    }
  }
  return summarize(wins, ties, losses, available.length, 'exact');
}

function makeDeals(available, draws, count = trials, initialSeed = 0x529b700d) {
  // Seeded partial Fisher–Yates. All choices use the same shuffled stocks.
  let seed = initialSeed;
  const width = Math.min(available.length, 8 + (draws - 1) * 6);
  const cards = new Uint8Array(count * width);
  const stock = new Uint8Array(available.length);
  for (let trial = 0; trial < count; trial += 1) {
    stock.set(available);
    for (let index = 0; index < width; index += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const next = index + Math.floor((seed >>> 0) / 0x1_0000_0000 * (stock.length - index));
      cards[trial * width + index] = stock[next];
      stock[next] = stock[index];
    }
  }
  return { cards, width, count };
}

function simulate(kept, rounds, deals, cache, availableCards, observeRound) {
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let trial = 0; trial < deals.count; trial += 1) {
    let next = trial * deals.width;
    let [left, right] = kept;
    for (let round = 0; round < rounds; round += 1) {
      const handA = [...left];
      const handB = [...right];
      while (handA.length < 4) handA.push(deals.cards[next++]);
      while (handB.length < 4) handB.push(deals.cards[next++]);
      const a = rankHand(handA, cache);
      const b = rankHand(handB, cache);
      observeRound?.(a, b, round);
      if (round === rounds - 1 || (!observeRound && a.keep.length === 4 && b.keep.length === 4)) {
        if (a.score < b.score) wins += 1;
        else if (a.score > b.score) losses += 1;
        else ties += 1;
        break;
      }
      left = a.keep;
      right = b.keep;
    }
  }
  return summarize(wins, ties, losses, availableCards, 'simulation');
}

function calculatePrepared(context, choices, observe, observeRound) {
  const { hands, remainingDraws, available, evaluations } = context;
  const kept = hands.map((hand, seat) => hand.filter(card => !choices[seat].includes(card)));
  const counts = choices.map(cards => cards.length);
  const futureDraws = Math.max(0, remainingDraws - 1);
  // Keeping a best valid subset means later draw counts can only decrease.
  const maxFutureCards = futureDraws && kept.reduce((sum, hand) => sum + 4 - Math.max(1, evaluateIds(hand).count), 0);
  if (counts[0] + counts[1] + futureDraws * maxFutureCards > available.length) return { error: 'deckTooSmall' };
  if (!observeRound && ((!counts[0] && !counts[1] && !maxFutureCards) ||
      (remainingDraws <= 1 && counts.every(count => count <= 1)))) {
    return exactShowdown(hands, kept, counts, available, evaluations, observe);
  }
  context.deals ??= makeDeals(available, remainingDraws, context.trials, context.seed);
  return simulate(kept, remainingDraws, context.deals, evaluations, available.length, observeRound);
}

function normalizeDiscards(discards, hand, remainingDraws) {
  const list = Array.isArray(discards) ? discards : discards === null ? [] : [discards];
  const cards = Array.from(list, normalizeCard);
  if ((!remainingDraws && cards.length) || new Set(cards).size !== cards.length || cards.some(card => !hand.includes(card))) return null;
  return cards;
}

/**
 * Heads-up showdown equity. The current discards are explicit, and the rest of
 * the hand follows the best valid subset policy with no discarded cards recycled.
 * A null or single card remains accepted for callers of the original calculator.
 */
export function calculateBadugiEquity(input) {
  const context = prepare(input);
  if (context.error) return context;
  const { discards = [null, null] } = input;
  if (!Array.isArray(discards) || discards.length !== 2) return { error: 'discard' };
  const choices = Array.from(discards, (choice, seat) => normalizeDiscards(choice, context.hands[seat], context.remainingDraws));
  if (choices.includes(null)) return { error: 'discard' };
  return calculatePrepared(context, choices);
}

export function compareBadugiDrawChoices(input) {
  if (input.rangeText != null) return compareBadugiRange(input);
  const context = prepare(input);
  if (context.error) return context;
  if (context.remainingDraws === 0) return { showdown: calculatePrepared(context, [[], []]) };

  const [hero, opponent] = context.hands;
  const options = badugiDiscardOptions(hero);
  const columns = Array.from({ length: 5 }, (_, count) => assumeDiscards(opponent, count));
  if (input.opponentDiscards != null) {
    const manual = normalizeDiscards(input.opponentDiscards, opponent, context.remainingDraws);
    if (manual === null) return { error: 'discard' };
    columns.push(manual);
  }
  const calculated = new Map();
  return {
    columns: columns.map(cards => {
      const key = [...cards].sort((a, b) => a - b).join(',');
      if (!calculated.has(key)) calculated.set(key, options.map(choice => calculatePrepared(context, [choice, cards])));
      return { cards: cards.map(card => PRACTICE_CARDS[card]), results: calculated.get(key) };
    }),
  };
}

function rangeContexts(input) {
  const parsed = parseBadugiRange(input.rangeText);
  if (parsed.error) return parsed;
  const counted = new Map();
  let excluded = 0;
  let totalWeight = 0;
  let excludedWeight = 0;
  const evaluations = new Map();
  for (const { cards, weight } of parsed.candidates) {
    const context = prepare({ ...input, hands: [input.hands[0], cards] });
    if (context.error === 'duplicate') {
      // Duplicates within confirmed cards were checked separately.
      excluded += 1;
      excludedWeight += weight;
      continue;
    }
    if (context.error) return context;
    context.evaluations = evaluations;
    const key = [...context.hands[1]].sort((a, b) => a - b).join(',');
    const existing = counted.get(key);
    if (existing) existing.weight += weight;
    else counted.set(key, { context, weight });
    totalWeight += weight;
  }
  if (!totalWeight) return { error: 'rangeBlocked' };
  const entries = [...counted.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, entry]) => {
    const { context } = entry;
    entry.weight /= totalWeight;
    context.trials = Math.max(32, Math.ceil(trials * entry.weight));
    context.seed = [...context.hands[1]].sort((a, b) => a - b)
      .reduce((value, card) => Math.imul(value ^ (card + 1), 16777619), 0x529b700d) || 1;
    return entry;
  });
  return {
    entries,
    range: { hands: entries.length, excluded, excludedPercent: excludedWeight / (totalWeight + excludedWeight) },
  };
}

function resolveOpponent(input) {
  if (input.rangeText == null) {
    const context = prepare(input);
    return context.error ? context : { entries: [{ context, weight: 1 }] };
  }
  // Validate known cards before interpreting overlap as a blocked candidate.
  const hero = input.hands?.[0];
  if (!Array.isArray(hero) || hero.length !== 4) return { error: 'handSize' };
  const deadCards = input.deadCards ?? [];
  if (!Array.isArray(deadCards)) return { error: 'card' };
  const known = Array.from([...hero, ...deadCards], normalizeCard);
  if (known.includes(null)) return { error: 'card' };
  if (new Set(known).size !== known.length) return { error: 'duplicate' };
  return rangeContexts(input);
}

function mixRange(entries, choose) {
  const probabilities = [0, 0, 0];
  let outcomes = 0;
  let availableCards;
  let method = 'exact';
  for (const { context, weight, discards } of entries) {
    const result = calculatePrepared(context, choose(discards));
    if (result.error) return result;
    const { wins, ties, losses } = result.players[0];
    [wins, ties, losses].forEach((count, index) => { probabilities[index] += weight * count / result.outcomes; });
    outcomes += result.outcomes;
    availableCards = result.availableCards;
    if (result.method === 'simulation') method = 'simulation';
  }
  return { ...summarize(...probabilities, availableCards, method), outcomes, range: true };
}

export function compareBadugiRange(input) {
  const resolved = resolveOpponent(input);
  if (resolved.error) return resolved;
  const { entries, range } = resolved;
  if (input.remainingDraws === 0) return { showdown: mixRange(entries, () => [[], []]), range };

  const options = badugiDiscardOptions(entries[0].context.hands[0]);
  return {
    range,
    columns: Array.from({ length: 5 }, (_, count) => {
      const matchups = entries.map(entry => ({ ...entry, discards: assumeDiscards(entry.context.hands[1], count) }));
      return { cards: null, results: options.map(choice => mixRange(matchups, discards => [choice, discards])) };
    }),
  };
}

function observeFinalBet(observations, settings, hero, opponent, share) {
  const { pot, bet, lead, call } = settings;
  let branch = observations.get(hero.key);
  if (!branch) {
    branch = { leadWeight: 0, checkWeight: 0, call: 0, check: 0, bet: 0 };
    observations.set(hero.key, branch);
  }
  if (opponent.size === 4 && opponent.high <= lead) {
    branch.leadWeight += 1;
    branch.call += calledBetValue(pot, bet, share);
  } else {
    branch.checkWeight += 1;
    branch.check += share * pot;
    branch.bet += opponent.size === 4 && opponent.high <= call ? calledBetValue(pot, bet, share) : pot;
  }
}

function actionValue(entries, choice, settings) {
  const combined = new Map();
  for (const { context, weight, discards } of entries) {
    const observations = new Map();
    const result = calculatePrepared(context, [choice, discards], (hero, opponent, share) =>
      observeFinalBet(observations, settings, hero, opponent, share));
    if (result.error) return result;
    const dealWeight = weight / result.outcomes;
    for (const [key, counts] of observations) {
      const totals = combined.get(key) ?? { leadWeight: 0, checkWeight: 0, call: 0, check: 0, bet: 0 };
      for (const name of Object.keys(counts)) totals[name] += counts[name] * dealWeight;
      combined.set(key, totals);
    }
  }
  let ev = 0;
  for (const totals of combined.values()) {
    ev += Math.max(0, totals.call) + Math.max(totals.check, totals.bet);
  }
  const terminal = combined.size === 1 ? combined.values().next().value : null;
  return { ev, terminal };
}

function modeledBet(hero, opponent, settings) {
  if (opponent.size === 4 && opponent.high <= settings.lead) {
    return hero.size === 4 && hero.high <= settings.heroCall ? 'called' : 'heroFold';
  }
  if (hero.size === 4 && hero.high <= settings.heroBet) {
    return opponent.size === 4 && opponent.high <= settings.call ? 'called' : 'opponentFold';
  }
  return 'checked';
}

function secondDrawValue(entries, choice, settings) {
  let ev = 0;
  let equity = 0;
  let variance = 0;
  let samples = 0;
  for (const { context, weight, discards } of entries) {
    let earlyAction;
    let sum = 0;
    let squares = 0;
    const result = calculatePrepared(context, [choice, discards], null, (hero, opponent, round) => {
      if (round === 0) {
        earlyAction = settings.middleBet > 0 ? modeledBet(hero, opponent, settings) : 'checked';
        return;
      }
      let net;
      if (earlyAction === 'heroFold') net = 0;
      else if (earlyAction === 'opponentFold') net = settings.pot;
      else {
        const invested = earlyAction === 'called' ? settings.middleBet : 0;
        const pot = settings.pot + 2 * invested;
        const share = hero.score < opponent.score ? 1 : hero.score === opponent.score ? 0.5 : 0;
        const lastAction = modeledBet(hero, opponent, settings);
        if (lastAction === 'heroFold') net = -invested;
        else if (lastAction === 'opponentFold') net = pot - invested;
        else if (lastAction === 'called') net = calledBetValue(pot, settings.bet, share) - invested;
        else net = share * pot - invested;
      }
      sum += net;
      squares += net * net;
    });
    if (result.error) return result;
    const n = result.outcomes;
    const mean = sum / n;
    ev += weight * mean;
    equity += weight * result.players[0].equity;
    variance += weight * weight * Math.max(0, squares / n - mean * mean) / (n - 1);
    samples += n;
  }
  return { ev, equity, evSE: Math.sqrt(variance), samples };
}

/** Fixed-limit conditional model, opponent acts first, one bet per street. */
export function compareBadugiFinalBet(input) {
  const resolved = resolveOpponent(input);
  if (resolved.error) return resolved;
  const { remainingDraws, opponentCount, settings } = input;
  const validRank = rank => Number.isInteger(rank) && rank >= 0 && rank <= 13;
  if (![0, 1, 2].includes(remainingDraws) || !settings ||
      !(settings.pot > 0 && settings.pot <= 1e12 && settings.bet > 0 && settings.bet <= 1e12) ||
      ![settings.lead, settings.call].every(validRank) || (remainingDraws === 2 && (
        ![settings.heroCall, settings.heroBet].every(validRank) || !(settings.middleBet >= 0 && settings.middleBet <= 1e12)
      ))) {
    return { error: 'betSettings' };
  }
  const entries = resolved.entries.map(entry => ({
    ...entry,
    discards: remainingDraws === 0 ? [] : input.opponentDiscards != null
      ? normalizeDiscards(input.opponentDiscards, entry.context.hands[1], remainingDraws)
      : ((remainingDraws === 2 ? [0, 1, 2, 3, 4] : [0, 1]).includes(opponentCount) ? assumeDiscards(entry.context.hands[1], opponentCount) : null),
  }));
  if (entries.some(({ discards }) => !discards || (remainingDraws < 2 && discards.length > 1))) return { error: 'betDrawCount' };

  const hand = entries[0].context.hands[0];
  const actions = (remainingDraws === 0 ? [[]] : [[], ...hand.map(card => [card])]).map(choice => ({
    cards: choice.map(card => PRACTICE_CARDS[card]),
    ...(remainingDraws === 2 ? secondDrawValue(entries, choice, settings) : actionValue(entries, choice, settings)),
  }));
  return { actions, range: resolved.range };
}
