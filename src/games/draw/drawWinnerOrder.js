// Button games award tied remainder chips clockwise, starting left of the button.
// https://www.barge.org/rulebook/ties-odd-chips.html
export function orderDrawWinners(winners, state) {
  const seatCount = state.players.length;
  const start = ((state.dealerIndex ?? 0) + 1) % seatCount;
  const distance = (seat) => (seat - start + seatCount) % seatCount;
  return [...winners].sort((a, b) => distance(a.seatIndex) - distance(b.seatIndex));
}
