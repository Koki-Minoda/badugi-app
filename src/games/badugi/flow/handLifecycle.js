import { firstBetterAfterBlinds } from "./actionUtils.js";

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
      isDealer: seat === nextDealerIdx,
      hasActedThisRound: seatOut,
      lastAction: "",
      isCPU: seatMeta === "CPU",
      tournamentPlayerId: base.tournamentPlayerId ?? null,
      tournamentSeatIndex: base.tournamentSeatIndex ?? null,
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
    }
    if (seatOut) {
      player.hand = [];
      player.isBusted = true;
      player.hasActedThisRound = true;
    }
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
      const antePay = Math.min(player.stack, anteValue);
      if (antePay > 0) {
        player.stack -= antePay;
        player.betThisRound += antePay;
        player.totalInvested = (player.totalInvested ?? 0) + antePay;
        player.lastAction = `ANTE(${antePay})`;
        anteEvents.push({ seat, amount: antePay });
      }
      if (player.stack === 0) {
        player.allIn = true;
        player.hasActedThisRound = true;
      }
    });
  }

  const sbIdx = (nextDealerIdx + 1) % numSeats;
  const bbIdx = (nextDealerIdx + 2) % numSeats;
  const sbPay = Math.min(players[sbIdx]?.stack ?? 0, sbValue);
  if (players[sbIdx]) {
    players[sbIdx].stack -= sbPay;
    players[sbIdx].betThisRound += sbPay;
    if (sbPay > 0) {
      players[sbIdx].totalInvested = (players[sbIdx].totalInvested ?? 0) + sbPay;
    }
    if (players[sbIdx].stack === 0) {
      players[sbIdx].allIn = true;
      players[sbIdx].hasActedThisRound = true;
    }
  }

  const bbPay = Math.min(players[bbIdx]?.stack ?? 0, bbValue);
  if (players[bbIdx]) {
    players[bbIdx].stack -= bbPay;
    players[bbIdx].betThisRound += bbPay;
    if (bbPay > 0) {
      players[bbIdx].totalInvested = (players[bbIdx].totalInvested ?? 0) + bbPay;
    }
    if (players[bbIdx].stack === 0) {
      players[bbIdx].allIn = true;
      players[bbIdx].hasActedThisRound = true;
    }
  }

  const initialCurrentBet = Math.max(sbPay, bbPay);
  const resolvedTurn = firstBetterAfterBlinds(players, nextDealerIdx);
  const activeCount = players.filter((p) => !p.seatOut).length;

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
