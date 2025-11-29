import { createTableState } from "../../core/models.js";

function sanitizeAvatar(avatar) {
  if (typeof avatar === "string" && avatar.length > 0) return avatar;
  return "♦";
}

export function buildPlayersFromSeatTypes(seatConfig = [], stackValue = 0, profile = {}) {
  return seatConfig.map((seatType, idx) => {
    const isHuman = seatType === "HUMAN";
    const isEmpty = seatType === "EMPTY";
    const heroName = profile?.name ?? "You";
    return {
      id: `seat-${idx}`,
      name: isHuman ? heroName : `CPU ${idx + 1}`,
      seatType,
      isCPU: !isHuman && !isEmpty,
      hand: [],
      folded: isEmpty,
      allIn: false,
      isBusted: isEmpty,
      hasActedThisRound: false,
      seatOut: isEmpty,
      stack: isEmpty ? 0 : stackValue,
      betThisRound: 0,
      bet: 0,
      totalInvested: 0,
      selected: [],
      showHand: isHuman,
      lastAction: "",
      hasDrawn: false,
      lastDrawCount: 0,
      titleBadge: isHuman ? profile?.titleBadge ?? "" : "",
      avatar: isHuman ? sanitizeAvatar(profile?.avatar) : undefined,
    };
  });
}

export function createBadugiTableState({
  seatConfig = [],
  startingStack = 500,
  heroProfile = {},
  dealerIndex = 0,
  structure = {},
} = {}) {
  const players = buildPlayersFromSeatTypes(seatConfig, startingStack, heroProfile).map(
    (player, seatIndex) => ({
      ...player,
      seatIndex,
      bet: player.bet ?? player.betThisRound ?? 0,
      totalInvested: 0,
      holeCards: [],
      boardCards: [],
    })
  );

  return createTableState({
    gameId: "badugi",
    players,
    dealerIndex,
    smallBlind: structure.sb ?? 10,
    bigBlind: structure.bb ?? 20,
    ante: structure.ante ?? 0,
    street: "BET",
    drawRoundIndex: 0,
    betRoundIndex: 0,
    actingPlayerIndex: (dealerIndex + 1) % (players.length || 1),
  });
}
