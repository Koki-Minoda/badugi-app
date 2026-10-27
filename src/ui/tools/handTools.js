import { evaluateHighHand } from '../../games/evaluators/high.js';
import { evaluateLowHand } from '../../games/evaluators/low.js';
import { evaluateBadugiHand } from '../../games/evaluators/badugi.js';
import { SpecialDrawEngine } from '../../games/draw/SpecialDrawEngine.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';

export const CHECKER_GAMES = [
  { id: 'high', name: 'High', count: 5 },
  { id: 'low27', name: '2-7 Low', count: 5 },
  { id: 'lowA5', name: 'A-5 Low', count: 5 },
  { id: 'badugi', name: 'Badugi', count: 4 },
  { id: 'hiLo8', name: 'High / Low 8', count: 5 },
  { id: 'badeucey', name: 'Badeucey', count: 5 },
  { id: 'badacey', name: 'Badacey', count: 5 },
  { id: 'archie', name: 'Archie', count: 5 },
];
export function validCards(cards, count) {
  return Array.isArray(cards) && cards.length === count && new Set(cards).size === count && cards.every(card => PRACTICE_CARDS.includes(card));
}
const evaluators = {
  high: cards => evaluateHighHand({ cards }),
  low27: cards => evaluateLowHand({ cards, lowType: '27' }),
  lowA5: cards => evaluateLowHand({ cards, lowType: 'A5' }),
  badugi: cards => evaluateBadugiHand({ cards }),
  badugi27: cards => evaluateBadugiHand({ cards, aceHigh:true }),
  low8: cards => evaluateLowHand({ cards, lowType: 'A5', requireQualifier: 8 }),
  archieHigh: cards => SpecialDrawEngine.prototype.evaluateComponent(cards, 'archieHigh'),
};
const components = { high: ['high'], low27: ['low27'], lowA5: ['lowA5'], badugi: ['badugi'], hiLo8: ['high','low8'], badeucey: ['badugi27','low27'], badacey: ['badugi','lowA5'], archie: ['archieHigh','low8'] };
export function compareHands(gameId, hands) {
  const game = CHECKER_GAMES.find(item => item.id === gameId);
  if (!game || hands.length !== 2 || hands.some(cards => !validCards(cards, game.count)) || new Set(hands.flat()).size !== game.count * 2) throw new Error('Invalid cards');
  const parts = components[gameId].map(id => {
    const evaluations = hands.map(cards => evaluators[id](cards));
    const scores = evaluations.map(e => e.isValid !== false && e.qualifies !== false ? e.rankPrimary : Infinity);
    const best = Math.min(...scores);
    return { id, evaluations, winners: Number.isFinite(best) ? scores.flatMap((score, seat) => score === best ? [seat] : []) : [] };
  });
  const unqualifiedChop = gameId === 'archie' && parts.every(part => !part.winners.length);
  if (unqualifiedChop) return { parts, shares: [.5, .5], unqualifiedChop, noQualifier: true };
  const qualified = parts.filter(part => part.winners.length);
  const shares = [0, 0];
  for (const part of qualified) for (const seat of part.winners) shares[seat] += 1 / qualified.length / part.winners.length;
  return { parts, shares, unqualifiedChop: false, noQualifier: !qualified.length };
}
// Reasons describe visible hand features. They do not estimate EV or optimal play.
export function recommendGames(cards) {
  if (!validCards(cards, 5)) return [];
  const low = evaluateLowHand({ cards, lowType: 'A5' });
  const deuce = evaluateLowHand({ cards, lowType: '27' });
  const badugi = evaluateBadugiHand({ cards });
  const high = evaluateHighHand({ cards });
  const result = [];
  if (low.metadata.categoryRank === 0 && low.metadata.ranks[0] <= 8) result.push({ id: 'ace_to_five_triple_draw', cards, reason: ['重複のない8以下が5枚あります。A-5ローの完成形を比べられます。', 'Five distinct ranks of eight or lower make an A-5 low to study.'] });
  if (deuce.metadata.categoryRank === 0 && deuce.metadata.ranks[0] <= 9) result.push({ id: 'deuce_to_seven_triple_draw', cards, reason: ['ペア・ストレート・フラッシュのない9以下です。2-7ローの比較に向いています。', 'Nine or lower without a pair, straight or flush: compare this 2-7 low.'] });
  if (badugi.metadata.size === 4) result.push({ id: 'badugi', cards: badugi.metadata.cards, reason: ['数字とスートの重ならない4枚があります。Badugiでそのまま練習できます。', 'Four cards have distinct ranks and suits. Practice this Badugi hand.'] });
  if (!result.length) result.push({ id: 'ace_to_five_triple_draw', cards, reason: [`A-5では一番高いカードが${low.metadata.ranks[0]}です。交換するカードを変えて比べてみましょう。`, `The highest A-5 rank is ${low.metadata.ranks[0]}. Compare different discard choices.`] });
  return { suggestions: result.slice(0, 3), high };
}
