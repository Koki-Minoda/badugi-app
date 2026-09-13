import { evaluateLowHand } from '../../games/evaluators/low.js';
import { evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';

export const QUIZ_TOPICS = [
  { id: 'lowball', ja: 'A-5と2-7の役比較', en: 'A-5 and 2-7 comparisons' },
  { id: 'badugi', ja: 'Badugiの有効枚数', en: 'Badugi card counts' },
  { id: 'low8', ja: '8-or-betterの成立条件', en: 'Eight-or-better qualification' },
];
const pairs = [
  [['AS', '2S', '3S', '4S', '5S'], ['7C', '5D', '4H', '3C', '2D']],
  [['7S', '6D', '5H', '4C', '3S'], ['8S', '6C', '4D', '3H', '2C']],
  [['8C', '7D', '4H', '3S', '2C'], ['8D', '6H', '5S', '4C', '3D']],
  [['AH', '2D', '3C', '4S', '6H'], ['7S', '4D', '3H', '2C', '5D']],
  [['7S', '5D', '4C', '3H', '2S'], ['7H', '5C', '4D', '3S', '2H']],
];
export const QUIZ_QUESTIONS = [
  ...pairs.flatMap(([left, right], index) => ['A5', '27'].map(lowType => ({ id: `compare-${index}-${lowType}`, topic: 'lowball', kind: 'compare', lowType, left, right }))),
  ...[
    ['AS', '2H', '3D', '4C'], ['AS', '2S', '3S', '4S'],
    ['AS', 'AH', '3D', '4C'], ['AS', '2H', '3H', '4C'],
    ['AS', 'AH', '2S', '2H'], ['KS', 'QH', 'JD', '10C'],
  ].map((cards, index) => ({ id: `badugi-${index}`, topic: 'badugi', kind: 'count', cards })),
  ...[
    ['AS', '2S', '3S', '4S', '5S'], ['8C', '7D', '6H', '4S', '2C'],
    ['9C', '7D', '5H', '3S', 'AC'], ['2S', '2H', '3D', '4C', '5D'],
    ['AC', 'AD', '3H', '4S', '5C'], ['8S', '7S', '6S', '5S', '4S'],
  ].map((cards, index) => ({ id: `low8-${index}`, topic: 'low8', kind: 'qualifier', cards })),
];

export function answerForQuestion(question) {
  if (question.kind === 'count') return String(evaluateBadugi(question.cards).count);
  if (question.kind === 'qualifier') {
    // The five-card qualifier also requires distinct ranks. The generic low
    // evaluator's qualifies flag alone only checks the highest rank.
    const evaluation = evaluateLowHand({ cards: question.cards, lowType: 'A5', requireQualifier: 8 });
    return evaluation.qualifies && evaluation.metadata.categoryRank === 0 ? 'yes' : 'no';
  }
  const left = evaluateLowHand({ cards: question.left, lowType: question.lowType });
  const right = evaluateLowHand({ cards: question.right, lowType: question.lowType });
  return left.rankPrimary === right.rankPrimary ? 'tie' : left.rankPrimary < right.rankPrimary ? 'left' : 'right';
}

export function quizExplanation(question, language = 'ja') {
  const ja = language === 'ja';
  if (question.kind === 'count') return ja
    ? `ランクとスートがどちらも重複しない組合せの最大は${answerForQuestion(question)}枚です。`
    : `The largest subset with distinct ranks and suits has ${answerForQuestion(question)} cards.`;
  if (question.kind === 'qualifier') return ja
    ? 'Aを1として、8以下の異なる5ランクが必要です。ペアは不成立。ストレートとフラッシュは成立を妨げません。'
    : 'You need five distinct ranks eight or lower, with aces low. Pairs do not qualify; straights and flushes do.';
  return question.lowType === 'A5'
    ? (ja ? 'Aは低く、ストレートとフラッシュは無視します。ペアがない同士なら高いランクから順に比べ、低い方が勝ちます。' : 'Aces are low; ignore straights and flushes. Between unpaired hands, compare the highest ranks first: lower wins.')
    : (ja ? 'Aは高く、ストレートとフラッシュは弱い役です。それらがない同士なら高いランクから順に比べ、低い方が勝ちます。' : 'Aces are high; straights and flushes count against you. Between unpaired non-straight, non-flush hands, compare the highest ranks first: lower wins.');
}

export function createQuizRound(topic, random = Math.random) {
  const questions = QUIZ_QUESTIONS.filter(question => question.topic === topic);
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  return questions.slice(0, 6);
}
