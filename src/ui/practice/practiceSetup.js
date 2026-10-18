export const PRACTICE_GAMES = [
  { id: 'badugi', name: 'Badugi', count: 4, defaults: ['AS', '2H', '3D', '3C'] },
  { id: 'ace_to_five_triple_draw', name: 'A-5 Triple Draw', count: 5, defaults: ['AS', '2H', '3D', '4C', 'KH'] },
  { id: 'deuce_to_seven_triple_draw', name: '2-7 Triple Draw', count: 5, defaults: ['2S', '3H', '4D', '7C', 'KH'] },
];
export const PRACTICE_CARDS = ['S', 'H', 'D', 'C'].flatMap(suit => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map(rank => rank + suit));
export function validatePracticeSetup(variant, cards) {
  const game = PRACTICE_GAMES.find(item => item.id === variant);
  return Boolean(game && Array.isArray(cards) && cards.length === game.count && new Set(cards).size === cards.length && cards.every(card => PRACTICE_CARDS.includes(card)));
}
