/**
 * Shared table/player/pot model helpers used by future GameEngine implementations.
 * These helpers are intentionally framework agnostic so they can work in
 * both the current Badugi-only stack and upcoming multi-game refactor (Spec 09).
 */

export const PlayerStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  FOLDED: "FOLDED",
  ALL_IN: "ALL_IN",
  BUSTED: "BUSTED",
  SITTING_OUT: "SITTING_OUT",
});

export function createPlayerState({
  id,
  name,
  seatIndex,
  stack = 0,
  bet = 0,
  totalInvested = 0,
  holeCards = [],
  boardCards = [],
  status = PlayerStatus.ACTIVE,
} = {}) {
  if (typeof seatIndex !== "number") {
    throw new Error("createPlayerState requires seatIndex");
  }
  return {
    id: id ?? `player-${seatIndex}`,
    name: name ?? `Seat ${seatIndex + 1}`,
    seatIndex,
    stack,
    bet,
    totalInvested,
    folded: status === PlayerStatus.FOLDED,
    allIn: status === PlayerStatus.ALL_IN,
    sittingOut: status === PlayerStatus.SITTING_OUT,
    bust: status === PlayerStatus.BUSTED,
    holeCards: [...holeCards],
    boardCards: [...boardCards],
  };
}

export function createPot({ amount = 0, eligiblePlayerIds = [] } = {}) {
  return {
    amount,
    eligiblePlayerIds: [...eligiblePlayerIds],
  };
}

export function createTableState({
  handId = `hand-${Date.now()}`,
  gameId,
  engineId,
  players = [],
  dealerIndex = 0,
  smallBlind = 0,
  bigBlind = 0,
  ante = 0,
  pots = [],
  deck = [],
  street = "INIT",
  drawRoundIndex = 0,
  actingPlayerIndex = 0,
  lastAggressorIndex = null,
  metadata = {},
} = {}) {
  if (!gameId) throw new Error("createTableState requires gameId");
  return {
    handId,
    gameId,
    engineId: engineId ?? gameId,
    players: [...players],
    dealerIndex,
    smallBlind,
    bigBlind,
    ante,
    pots: [...pots],
    deck: [...deck],
    street,
    drawRoundIndex,
    actingPlayerIndex,
    lastAggressorIndex,
    metadata: { ...metadata },
    isHandOver: false,
  };
}

export function cloneTableState(state) {
  return createTableState({
    ...state,
    players: state.players.map((p) => ({ ...p })),
    pots: state.pots.map((pot) => {
      const eligibleSeats =
        pot.eligiblePlayerIds ?? pot.eligible ?? pot.eligibleSeats ?? [];
      return {
        ...pot,
        eligiblePlayerIds: [...eligibleSeats],
      };
    }),
    deck: [...(state.deck ?? [])],
    metadata: { ...(state.metadata ?? {}) },
  });
}
