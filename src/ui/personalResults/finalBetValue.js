// Net chips from the decision point, after each player adds one bet.
export function calledBetValue(pot, bet, showdownShare) {
  return showdownShare * (pot + 2 * bet) - bet;
}
