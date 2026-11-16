import { compareBadugiEvaluations, evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';

const deck = new Set(PRACTICE_CARDS);

function normalizeCard(card) {
  if (typeof card !== 'string') return null;
  const normalized = card.trim().toUpperCase().replace(/^T/, '10');
  return deck.has(normalized) ? normalized : null;
}

function evaluateReplacements(hand, discard, available) {
  if (discard === null) return [{ drawn: null, evaluation: evaluateBadugi(hand) }];
  const kept = hand.filter(card => card !== discard);
  return available.map(drawn => ({ drawn, evaluation: evaluateBadugi([...kept, drawn]) }));
}

/**
 * Exact heads-up showdown equity with zero or one draw round remaining.
 * Each player independently stands pat (null) or discards one named card.
 * The initial eight cards, including discards, and all dead cards are excluded
 * from a shared draw pile. Count distinct ordered deals, one card per player.
 */
export function calculateBadugiEquity({ hands, remainingDraws, discards = [null, null], deadCards = [] }) {
  if (remainingDraws !== 0 && remainingDraws !== 1) return { error: 'drawRounds' };
  if (!Array.isArray(hands) || hands.length !== 2 || Array.from(hands).some(hand => !Array.isArray(hand) || hand.length !== 4)) {
    return { error: 'handSize' };
  }
  if (!Array.isArray(deadCards)) return { error: 'card' };
  const normalizedHands = hands.map(hand => Array.from(hand, normalizeCard));
  const known = [...normalizedHands.flat(), ...Array.from(deadCards, normalizeCard)];
  if (known.includes(null)) return { error: 'card' };
  const used = new Set(known);
  if (used.size !== known.length) return { error: 'duplicate' };

  if (!Array.isArray(discards) || discards.length !== 2) return { error: 'discard' };
  const choices = Array.from(discards, (discard, seat) => {
    if (discard === null) return null;
    const card = normalizeCard(discard);
    return remainingDraws === 1 && normalizedHands[seat].includes(card) ? card : undefined;
  });
  if (choices.includes(undefined)) return { error: 'discard' };

  const available = PRACTICE_CARDS.filter(card => !used.has(card));
  if (available.length < choices.filter(Boolean).length) return { error: 'deckTooSmall' };

  const [first, second] = normalizedHands.map((hand, seat) => evaluateReplacements(hand, choices[seat], available));
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (const a of first) {
    for (const b of second) {
      if (a.drawn !== null && a.drawn === b.drawn) continue;
      const comparison = compareBadugiEvaluations(a.evaluation, b.evaluation);
      if (comparison < 0) wins += 1;
      else if (comparison > 0) losses += 1;
      else ties += 1;
    }
  }

  const outcomes = wins + ties + losses;
  return {
    outcomes,
    availableCards: available.length,
    players: [
      { wins, ties, losses, equity: (wins + ties / 2) / outcomes },
      { wins: losses, ties, losses: wins, equity: (losses + ties / 2) / outcomes },
    ],
  };
}
