export function countPlayerFlags(snapshot = {}) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const foldedPlayers = [];
  const allInPlayers = [];
  let activePlayers = 0;
  let activeNonAllInPlayers = 0;

  players.forEach((player, seatIndex) => {
    if (!player || player.seatOut || player.sittingOut || player.busted || player.isBusted) return;
    const folded = Boolean(player.folded || player.hasFolded);
    const allIn = Boolean(player.allIn || player.isAllIn);
    if (folded) foldedPlayers.push(seatIndex);
    if (allIn) allInPlayers.push(seatIndex);
    if (!folded) {
      activePlayers += 1;
      if (!allIn) activeNonAllInPlayers += 1;
    }
  });

  return {
    seatCount: players.length,
    foldedPlayers,
    allInPlayers,
    activePlayers,
    activeNonFoldedPlayers: activePlayers,
    activeNonAllInPlayers,
  };
}

export function effectiveOpportunityPlayerCount({
  activePlayers = 0,
  foldedPlayers = [],
  allInPlayers = [],
  bettingEligiblePlayers = 0,
  potEligiblePlayers = 0,
  replayCompatibleMode = false,
} = {}) {
  const active = Math.max(0, Number(activePlayers) || 0);
  if (!replayCompatibleMode) return active;

  const bettingEligible = Math.max(0, Number(bettingEligiblePlayers) || 0);
  const potEligible = Math.max(0, Number(potEligiblePlayers) || 0);
  const foldedCount = Array.isArray(foldedPlayers) ? foldedPlayers.length : 0;
  const allInCount = Array.isArray(allInPlayers) ? allInPlayers.length : 0;
  const activeContestingPlayers = Math.max(0, active - Math.max(0, allInCount));

  const candidates = [active, bettingEligible, potEligible, activeContestingPlayers].filter((value) => value > 0);
  if (!candidates.length) return active;
  const minimumContesting = Math.min(...candidates);

  if (foldedCount === 0 && bettingEligible > 0) {
    return Math.min(active, Math.max(bettingEligible, potEligible || bettingEligible));
  }
  return Math.min(active, Math.max(2, minimumContesting));
}
