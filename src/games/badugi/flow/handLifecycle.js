import {
  applyChips,
  firstBetterAfterBlinds,
  getBlindSeatsForPlayers,
  isPlayerEligibleForBlinds,
} from "./actionUtils.js";

export function computeNextBlindLevel({
  isFreshStart,
  currentBlindLevelIndex = 0,
  currentHandsInLevel = 0,
  blindStructure = [],
  lastStructureIndex = 0,
}) {
  let nextIndex = isFreshStart ? 0 : currentBlindLevelIndex;
  let nextHandsInLevel = isFreshStart ? 1 : Math.max(1, currentHandsInLevel + 1);
  const structureAtLevel =
    blindStructure[nextIndex] ?? blindStructure[lastStructureIndex] ?? blindStructure[0] ?? {};
  const handCap = structureAtLevel.hands;
  const shouldLevelUp =
    !isFreshStart &&
    Number.isFinite(handCap) &&
    handCap > 0 &&
    nextHandsInLevel > handCap &&
    nextIndex < lastStructureIndex;
  if (shouldLevelUp) {
    nextIndex = Math.min(nextIndex + 1, lastStructureIndex);
    nextHandsInLevel = 1;
  }
  return {
    blindLevelIndex: nextIndex,
    handsInLevel: nextHandsInLevel,
  };
}

export function buildNextHandState({
  prevPlayers = null,
  currentPlayers = [],
  numSeats = 6,
  seatConfig = [],
  startingStack = 0,
  heroProfile = {},
  nextDealerIdx = 0,
  blindStructure = [],
  blindState = { blindLevelIndex: 0, handsInLevel: 0 },
  lastStructureIndex = 0,
  drawCardsForSeat = null,
}) {
  const isFreshStart = !prevPlayers;
  const { blindLevelIndex, handsInLevel } = computeNextBlindLevel({
    isFreshStart,
    currentBlindLevelIndex: blindState.blindLevelIndex ?? 0,
    currentHandsInLevel: blindState.handsInLevel ?? 0,
    blindStructure,
    lastStructureIndex,
  });

  const structureForHand =
    blindStructure[blindLevelIndex] ??
    blindStructure[lastStructureIndex] ??
    blindStructure[0] ??
    { sb: 0, bb: 0, ante: 0 };
  const sbValue = structureForHand.sb ?? 0;
  const bbValue = structureForHand.bb ?? 0;
  const anteValue = structureForHand.ante ?? 0;

  const baseSeats = Array.from({ length: numSeats }, (_, seat) => {
    const seatType =
      seatConfig[seat] ??
      prevPlayers?.[seat]?.seatType ??
      currentPlayers?.[seat]?.seatType ??
      (seat === 0 ? "HUMAN" : "CPU");
    const defaultName =
      seatType === "HUMAN"
        ? "You"
        : seatType === "CPU"
        ? `CPU ${seat + 1}`
        : `Seat ${seat + 1}`;
    const baseStack =
      seatType === "EMPTY"
        ? 0
        : prevPlayers?.[seat]?.stack ??
          currentPlayers?.[seat]?.stack ??
          startingStack;
    return {
      name: prevPlayers?.[seat]?.name ?? currentPlayers?.[seat]?.name ?? defaultName,
      stack: baseStack,
      isBusted:
        prevPlayers?.[seat]?.isBusted ??
        currentPlayers?.[seat]?.isBusted ??
        seatType === "EMPTY",
      seatType,
      seatOut:
        prevPlayers?.[seat]?.seatOut ??
        currentPlayers?.[seat]?.seatOut ??
        seatType === "EMPTY",
      tournamentPlayerId:
        prevPlayers?.[seat]?.tournamentPlayerId ??
        currentPlayers?.[seat]?.tournamentPlayerId ??
        null,
      tournamentSeatIndex:
        prevPlayers?.[seat]?.tournamentSeatIndex ??
        currentPlayers?.[seat]?.tournamentSeatIndex ??
        null,
      cpuCharacterId:
        prevPlayers?.[seat]?.cpuCharacterId ??
        currentPlayers?.[seat]?.cpuCharacterId ??
        null,
      cpuStyle:
        prevPlayers?.[seat]?.cpuStyle ??
        currentPlayers?.[seat]?.cpuStyle ??
        null,
      avatar:
        prevPlayers?.[seat]?.avatar ??
        currentPlayers?.[seat]?.avatar ??
        null,
      avatarUrl:
        prevPlayers?.[seat]?.avatarUrl ??
        currentPlayers?.[seat]?.avatarUrl ??
        null,
    };
  });

  const seatOutWarnings = [];
  const filteredPrev = baseSeats.map((seatState) => {
    const busted = seatState.isBusted || seatState.stack <= 0 || seatState.seatType === "EMPTY";
    if (busted) {
      seatOutWarnings.push(`[SEAT-OUT] ${seatState.name} is out (stack=${seatState.stack})`);
      return {
        ...seatState,
        stack: 0,
        folded: true,
        hasFolded: true,
        allIn: true,
        seatOut: true,
        isBusted: true,
      };
    }
    return {
      ...seatState,
      seatOut: false,
      isBusted: false,
      hasFolded: false,
      folded: false,
      allIn: false,
    };
  });

  const drawContext = {
    dealerIdx: nextDealerIdx,
    seats: filteredPrev.map((seatState, seatIndex) => ({
      seatIndex,
      seatOut: seatState.seatOut,
      seatType: seatState.seatType,
      stack: seatState.stack,
    })),
  };

  const players = Array.from({ length: numSeats }, (_, seat) => {
    const base = filteredPrev[seat];
    const seatMeta = base.seatType ?? seatConfig[seat] ?? (seat === 0 ? "HUMAN" : "CPU");
    const seatOut = base.seatOut ?? false;
    const player = {
      seatIndex: seat,
      name: base.name ?? `P${seat + 1}`,
      seatType: seatMeta,
      stack: Math.max(base.stack ?? startingStack, 0),
      seatOut,
      isBusted: base.isBusted ?? false,
      hand: [],
      folded: seatOut,
      hasFolded: seatOut,
      allIn: seatOut,
      betThisRound: 0,
      totalInvested: 0,
      hasDrawn: false,
      lastDrawCount: 0,
      selected: [],
      showHand: seatMeta === "HUMAN",
      hasActedThisRound: seatOut,
      lastAction: "",
      isCPU: seatMeta === "CPU",
      tournamentPlayerId: base.tournamentPlayerId ?? null,
      tournamentSeatIndex: base.tournamentSeatIndex ?? null,
      cpuCharacterId: base.cpuCharacterId ?? null,
      cpuStyle: base.cpuStyle ?? null,
      avatar: base.avatar ?? undefined,
      avatarUrl: base.avatarUrl ?? null,
    };
    if (typeof drawCardsForSeat === "function" && !seatOut) {
      player.hand = drawCardsForSeat(seat, player, drawContext) ?? [];
    } else {
      player.hand = seatOut ? [] : [];
    }
    if (seat === 0 && heroProfile) {
      player.name = heroProfile.name ?? player.name;
      player.titleBadge = heroProfile.titleBadge ?? player.titleBadge;
      player.avatar = heroProfile.avatar ?? player.avatar;
      player.avatarUrl = heroProfile.avatarUrl ?? player.avatarUrl ?? null;
    }
    if (seatOut) {
      player.hand = [];
      player.isBusted = true;
      player.hasActedThisRound = true;
    }
    player.isDealer = seat === nextDealerIdx;
    player.isSeated = !seatOut;
    player.isActiveInGame = !seatOut && !player.isBusted;
    return player;
  });

  const handStartingStacksById = players.reduce((acc, player) => {
    if (player?.tournamentPlayerId) {
      acc[player.tournamentPlayerId] = player.stack;
    }
    return acc;
  }, {});

  const anteEvents = [];
  if (anteValue > 0) {
    players.forEach((player, seat) => {
      if (player.seatOut) return;
      const applied = applyChips(player, anteValue);
      if (applied > 0) {
        player.betThisRound += applied;
        player.lastAction = `ANTE(${applied})`;
        anteEvents.push({ seat, amount: applied });
      }
      if (player.stack === 0) {
        player.allIn = true;
        player.hasActedThisRound = true;
      }
    });
  }

  const {
    sbIdx,
    bbIdx,
    sbPay,
    bbPay,
    numActivePlayers,
  } = assignBlinds(players, nextDealerIdx, sbValue, bbValue);

  const initialCurrentBet = Math.max(sbPay, bbPay);
  const resolvedTurn = firstBetterAfterBlinds(players, nextDealerIdx);
  const activeCount = numActivePlayers;

  return {
    players,
    blindLevelIndex,
    handsInLevel,
    blindValues: { sb: sbValue, bb: bbValue, ante: anteValue },
    dealerIdx: nextDealerIdx,
    sbIdx,
    bbIdx,
    sbPay,
    bbPay,
    anteEvents,
    initialCurrentBet,
    resolvedTurn,
    activeCount,
    handStartingStacksById,
    seatOutWarnings,
  };
}

function assignBlinds(players = [], dealerIdx = 0, smallBlind = 0, bigBlind = 0) {
  const eligibleCount = players.reduce(
    (count, player) => count + (isPlayerEligibleForBlinds(player) ? 1 : 0),
    0,
  );

  if (eligibleCount < 2) {
    return {
      sbIdx: null,
      bbIdx: null,
      sbPay: 0,
      bbPay: 0,
      numActivePlayers: eligibleCount,
    };
  }

  const { sbIdx, bbIdx } = getBlindSeatsForPlayers(players, dealerIdx);

  const sbPay = applyBlindPayment(players, sbIdx, smallBlind);
  const bbPay = applyBlindPayment(players, bbIdx, bigBlind);

  return {
    sbIdx,
    bbIdx,
    sbPay,
    bbPay,
    numActivePlayers: eligibleCount,
  };
}

function applyBlindPayment(players = [], seatIndex = null, amount = 0) {
  if (!Array.isArray(players) || typeof seatIndex !== "number") return 0;
  const player = players[seatIndex];
  if (!player || amount <= 0) return 0;
  const pay = applyChips(player, amount);
  if (pay <= 0) return 0;

  player.betThisRound = (player.betThisRound ?? 0) + pay;
  if (player.stack === 0) {
    player.allIn = true;
    player.hasActedThisRound = true;
  } else {
    player.hasActedThisRound = false;
  }
  return pay;
}
