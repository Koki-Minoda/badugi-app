// The six-seat trainer masks BET/RAISE unless the whole fixed-limit increment
// fits after calling. The live controller may still allow a short all-in raise.
export function canBadugiTrainingModelIncreaseBet({ stack, toCall, liveBetSize, trainerBetSize, canRaise }) {
  return Boolean(canRaise && Number.isFinite(stack) && Number.isFinite(toCall) &&
    Number.isFinite(liveBetSize) && Number.isFinite(trainerBetSize) &&
    stack >= toCall + Math.max(liveBetSize, trainerBetSize));
}
