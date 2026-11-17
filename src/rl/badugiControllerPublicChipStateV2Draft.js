// D03 offline draft. Read the current hand's blind level, not a stale
// constructor betSize, which can differ after an MTT level change.
export function deriveBadugiControllerPublicChipStateV2Draft(controller, snapshot) {
  const levels = controller?.config?.blindStructure;
  const levelIndex = snapshot?.blindLevelIndex;
  if (!Array.isArray(levels) || !Number.isInteger(levelIndex) ||
      levelIndex < 0 || levelIndex >= levels.length) {
    throw new TypeError('v2 draft requires the active controller blind level');
  }
  const bigBlind = Number(levels[levelIndex]?.bb);
  const players = snapshot?.players;
  if (!Array.isArray(players) || !Number.isFinite(bigBlind) || bigBlind <= 0) {
    throw new TypeError('v2 draft requires active blinds and public players');
  }
  const bets = players.map((player) => Number(player?.betThisRound));
  const investments = players.map((player) => Number(player?.totalInvested));
  if ([...bets, ...investments].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('v2 draft requires public chip accounting');
  }
  const currentBet = Math.max(0, ...bets);
  const pot = investments.reduce((sum, value) => sum + value, 0);
  const raiseCount = Number(snapshot.raiseCountThisRound ?? snapshot.metadata?.raiseCountThisRound ?? 0);
  return { bigBlind, currentBet, pot, raiseCount };
}
