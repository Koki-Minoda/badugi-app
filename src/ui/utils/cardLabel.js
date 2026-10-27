const suitSymbols = {S: '♠', H: '♥', D: '♦', C: '♣'};

export function formatCardLabel(card) {
  const value = String(card || '');
  const symbol = suitSymbols[value.slice(-1).toUpperCase()];
  return symbol ? `${value.slice(0, -1)}${symbol}` : value;
}
