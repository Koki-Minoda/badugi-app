import {
  expectedFirstActor,
  expectedNextActor,
  positionLabelForSeat,
} from "./expectedBettingActor.js";

function seatsWhere(players = [], predicate) {
  return (Array.isArray(players) ? players : []).flatMap((player, seat) =>
    predicate(player, seat) ? [seat] : [],
  );
}

export function summarizeSeats(players = []) {
  const list = Array.isArray(players) ? players : [];
  return {
    activeSeats: seatsWhere(
      list,
      (player) => player && !player.folded && !player.hasFolded && !player.seatOut && !player.isBusted,
    ),
    foldedSeats: seatsWhere(list, (player) => Boolean(player?.folded || player?.hasFolded)),
    allInSeats: seatsWhere(list, (player) => Boolean(player?.allIn)),
    contributions: Object.fromEntries(
      list.map((player, seat) => [
        seat,
        Math.max(0, Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0),
      ]),
    ),
  };
}

export function buildActionOrderAuditEntry({
  handId = null,
  variantId,
  phase = "BET",
  drawRound = 0,
  betRound = null,
  actionIndex = 0,
  buttonSeat = null,
  sbSeat = null,
  bbSeat = null,
  actorSeat = null,
  previousActorSeat = null,
  players = [],
  currentBet = 0,
  action = null,
  legalActions = [],
  actedThisStreet = [],
} = {}) {
  const playerCount = Array.isArray(players) ? players.length : 0;
  const { activeSeats, foldedSeats, allInSeats, contributions } = summarizeSeats(players);
  const expectedActorSeat =
    typeof previousActorSeat === "number"
      ? expectedNextActor({
          previousActorSeat,
          playerCount,
          activeSeats,
          foldedSeats,
          allInSeats,
          currentBet,
          contributions,
          actedThisStreet,
        })
      : expectedFirstActor({
          playerCount,
          buttonSeat,
          sbSeat,
          bbSeat,
          phase,
          drawRound,
          activeSeats,
          foldedSeats,
          allInSeats,
        });
  const isOrderValid = actorSeat === expectedActorSeat;
  const actorPosition = positionLabelForSeat({ seat: actorSeat, playerCount, buttonSeat, sbSeat, bbSeat });
  const expectedActorPosition = positionLabelForSeat({
    seat: expectedActorSeat,
    playerCount,
    buttonSeat,
    sbSeat,
    bbSeat,
  });

  return {
    handId,
    variantId,
    phase,
    drawRound,
    betRound,
    actionIndex,
    buttonSeat,
    sbSeat,
    bbSeat,
    actorSeat,
    actorPosition,
    expectedActorSeat,
    expectedActorPosition,
    action,
    legalActions,
    alreadyActedThisStreet: [...actedThisStreet],
    foldedSeats,
    allInSeats,
    streetContribution: contributions,
    currentBet,
    toCall: Math.max(0, Number(currentBet) - Number(contributions?.[actorSeat] ?? 0)),
    isOrderValid,
    reason: isOrderValid
      ? "actor matches canonical betting order"
      : `${actorPosition} acted while ${expectedActorPosition} was expected`,
  };
}

export function formatOrderAuditLine(entry) {
  return `[ORDER_AUDIT] ${JSON.stringify(entry)}`;
}

