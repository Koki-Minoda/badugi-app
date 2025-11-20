export function deriveForcedBetConfig(profile) {
  const forced = profile?.forcedBets ?? { type: "blinds" };
  switch (forced.type) {
    case "limit":
      return {
        smallBlind: forced.smallBet ?? 5,
        bigBlind: forced.bigBet ?? 10,
        ante: forced.ante ?? 0,
        betSize: forced.bigBet ?? 10,
      };
    case "stud":
      return {
        smallBlind: forced.bringIn ?? 2,
        bigBlind: forced.bringIn ?? 2,
        ante: forced.ante ?? 1,
        betSize: forced.bringIn ?? 2,
      };
    case "mixed":
      return {
        smallBlind: forced.smallBlind ?? 10,
        bigBlind: forced.bigBlind ?? 20,
        ante: forced.ante ?? 0,
        betSize: forced.bigBet ?? forced.bigBlind ?? 20,
      };
    case "blinds":
    default:
      return {
        smallBlind: forced.smallBlind ?? 10,
        bigBlind: forced.bigBlind ?? 20,
        ante: forced.ante ?? 0,
        betSize: forced.bigBlind ?? 20,
      };
  }
}
