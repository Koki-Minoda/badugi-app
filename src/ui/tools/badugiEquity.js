import { compareBadugiEvaluations, evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';

const deck = new Map(PRACTICE_CARDS.map((card, index) => [card, index]));
const trials = 10_000;

function normalizeCard(card) {
  if (typeof card !== 'string') return null;
  const normalized = card.trim().toUpperCase().replace(/^T/, '10');
  return deck.get(normalized) ?? null;
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
    hand = { score, keep: evaluation.activeCards.map(card => deck.get(card)) };
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

function exactShowdown(hands, kept, counts, available, cache) {
  const handsByReplacement = kept.map((cards, seat) => counts[seat]
    ? available.map(card => rankHand([...cards, card], cache).score)
    : [rankHand(hands[seat], cache).score]);
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let a = 0; a < handsByReplacement[0].length; a += 1) {
    for (let b = 0; b < handsByReplacement[1].length; b += 1) {
      if (counts[0] && counts[1] && a === b) continue;
      const delta = handsByReplacement[0][a] - handsByReplacement[1][b];
      if (delta < 0) wins += 1;
      else if (delta > 0) losses += 1;
      else ties += 1;
    }
  }
  return summarize(wins, ties, losses, available.length, 'exact');
}

function makeDeals(available, draws) {
  // Seeded partial Fisher–Yates. All choices use the same shuffled stocks.
  let seed = 0x529b700d;
  const width = Math.min(available.length, 8 + (draws - 1) * 6);
  const cards = new Uint8Array(trials * width);
  const stock = new Uint8Array(available.length);
  for (let trial = 0; trial < trials; trial += 1) {
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
  return { cards, width };
}

function simulate(kept, rounds, deals, cache, availableCards) {
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    let next = trial * deals.width;
    let [left, right] = kept;
    for (let round = 0; round < rounds; round += 1) {
      const handA = [...left];
      const handB = [...right];
      while (handA.length < 4) handA.push(deals.cards[next++]);
      while (handB.length < 4) handB.push(deals.cards[next++]);
      const a = rankHand(handA, cache);
      const b = rankHand(handB, cache);
      if (round === rounds - 1 || (a.keep.length === 4 && b.keep.length === 4)) {
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

function calculatePrepared(context, choices) {
  const { hands, remainingDraws, available, evaluations } = context;
  const kept = hands.map((hand, seat) => hand.filter(card => !choices[seat].includes(card)));
  const counts = choices.map(cards => cards.length);
  const futureDraws = Math.max(0, remainingDraws - 1);
  // Keeping a best valid subset means later draw counts can only decrease.
  const maxFutureCards = futureDraws && kept.reduce((sum, hand) => sum + 4 - Math.max(1, evaluateIds(hand).count), 0);
  if (counts[0] + counts[1] + futureDraws * maxFutureCards > available.length) return { error: 'deckTooSmall' };
  if ((!counts[0] && !counts[1] && !maxFutureCards) ||
      (remainingDraws <= 1 && counts.every(count => count <= 1))) {
    return exactShowdown(hands, kept, counts, available, evaluations);
  }
  context.deals ??= makeDeals(available, remainingDraws);
  return simulate(kept, remainingDraws, context.deals, evaluations, available.length);
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
