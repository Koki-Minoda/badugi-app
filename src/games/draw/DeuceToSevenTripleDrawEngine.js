import { DrawEngineBase } from "../core/drawEngineBase.js";
import { cloneTableState, createTableState } from "../core/models.js";
import { IllegalActionError, assertSeatIsActive } from "../core/errors.js";
import { applyChips } from "../core/applyChips.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { evaluateLowHand, formatLowHandLabel } from "../evaluators/low.js";
import { compareEvaluations } from "../evaluators/registry.js";
import { normalizeDrawAction as normalizeCoreDrawAction } from "../core/draw/normalizeDrawAction.js";

const DEFAULT_SEAT_CONFIG = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];
const DEFAULT_PAT_HIGH_RANK = 8;
const DEFAULT_RAISE_HIGH_RANK = 7;
const DEFAULT_DRAW_KEEP_MAX_RANK = 9;

function isEmptySeat(seatType) {
  return seatType === "EMPTY";
}

function createPlayers({ seatConfig = DEFAULT_SEAT_CONFIG, startingStack = 500, heroProfile = {} } = {}) {
  return seatConfig.map((seatType, seatIndex) => {
    const sittingOut = isEmptySeat(seatType);
    const isHuman = seatType === "HUMAN";
    return {
      id: `seat-${seatIndex}`,
      playerId: `seat-${seatIndex}`,
      name: isHuman ? heroProfile?.name ?? "You" : `CPU ${seatIndex + 1}`,
      seatIndex,
      seatType,
      isCPU: !isHuman && !sittingOut,
      hand: [],
      stack: sittingOut ? 0 : startingStack,
      bet: 0,
      totalInvested: 0,
      folded: sittingOut,
      allIn: false,
      sittingOut,
      seatOut: sittingOut,
      hasActedThisRound: false,
      hasDrawn: false,
      lastDrawCount: 0,
      lastAction: "",
    };
  });
}

function getActivePlayers(players = []) {
  return players.filter((player) => !player.folded && !player.sittingOut);
}

function getBettingPlayers(players = []) {
  return players.filter((player) => !player.folded && !player.sittingOut && !player.allIn);
}

function getDrawableSeatIndexes(players = []) {
  return players
    .map((player, seatIndex) => ({ player, seatIndex }))
    .filter(({ player }) => !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted)
    .map(({ seatIndex }) => seatIndex);
}

function findFirstActiveSeat(players = [], startIndex = 0) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = players[seatIndex];
    if (player && !player.folded && !player.sittingOut && !player.allIn) {
      return seatIndex;
    }
  }
  return null;
}

function findFirstDrawableSeat(players = [], startIndex = 0) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = players[seatIndex];
    if (player && !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted) {
      return seatIndex;
    }
  }
  return null;
}

function findSeatIndex(state, action = {}) {
  if (typeof action.seatIndex === "number") return action.seatIndex;
  if (typeof action.playerId === "string") {
    return state.players.findIndex((player) => player.playerId === action.playerId || player.id === action.playerId);
  }
  return state.actingPlayerIndex;
}

function getCardsInPlay(players = []) {
  return players.flatMap((player) => player.hand ?? []);
}

function settleCurrentBets(state) {
  const committed = state.players.reduce((sum, player) => sum + Math.max(0, player.bet ?? 0), 0);
  const players = state.players.map((player) => ({
    ...player,
    bet: 0,
    hasActedThisRound: false,
  }));
  const existingPots = Array.isArray(state.pots) ? state.pots.map((pot) => ({ ...pot })) : [];
  if (committed > 0) {
    if (existingPots.length) {
      existingPots[0] = {
        ...existingPots[0],
        amount: Math.max(0, existingPots[0].amount ?? 0) + committed,
      };
    } else {
      existingPots.push({
        amount: committed,
        eligiblePlayerIds: getActivePlayers(players).map((player) => player.playerId ?? player.id),
      });
    }
  }
  return { players, pots: existingPots, committed };
}

function getStreetBetUnit(state) {
  const bigBlind = Math.max(1, Number(state.bigBlind) || 1);
  const drawRoundIndex = Number(state.drawRoundIndex) || 0;
  const smallBetBB = Math.max(1, Number(state.metadata?.smallBetBB) || 1);
  const bigBetBB = Math.max(smallBetBB, Number(state.metadata?.bigBetBB) || 2);
  const bigBetStartsAtDrawRound = Math.max(
    1,
    Number(state.metadata?.bigBetStartsAtDrawRound) || 2,
  );
  return bigBlind * (drawRoundIndex >= bigBetStartsAtDrawRound ? bigBetBB : smallBetBB);
}

function getRaiseCap(state) {
  const cap = Number(state.metadata?.raiseCap);
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 4;
}

function getCurrentBet(state) {
  const activeBets = getActivePlayers(state.players).map((player) => player.bet ?? 0);
  return Math.max(0, state.metadata?.currentBet ?? 0, ...activeBets);
}

function normalizeActionType(action = {}) {
  return String(action.type ?? "").toUpperCase();
}

function parseRank(card, { aceLow = false } = {}) {
  const match = String(card ?? "").trim().toUpperCase().match(/^(10|[2-9TJQKA])/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = match[1];
  if (value === "A") return aceLow ? 1 : 14;
  if (value === "K") return 13;
  if (value === "Q") return 12;
  if (value === "J") return 11;
  if (value === "T" || value === "10") return 10;
  return Number(value);
}

function parseSuit(card) {
  const match = String(card ?? "").trim().toUpperCase().match(/[CDHS]$/);
  return match ? match[0] : "";
}

function isCleanLowEvaluation(evaluation) {
  return Boolean(evaluation?.isValid && (evaluation?.metadata?.penalty ?? 0) === 0);
}

function getHighestLowRank(evaluation) {
  const ranks = evaluation?.metadata?.ranks;
  return Array.isArray(ranks) && ranks.length ? ranks[0] : Number.POSITIVE_INFINITY;
}

function getDrawIndexesForLowball(hand = [], evaluation = null, options = {}) {
  if (!Array.isArray(hand) || hand.length === 0) return [];
  const {
    aceLow = false,
    drawKeepMaxRank = DEFAULT_DRAW_KEEP_MAX_RANK,
    patHighRank = DEFAULT_PAT_HIGH_RANK,
    penalizeStraightFlush = true,
  } = options;
  if (isCleanLowEvaluation(evaluation) && getHighestLowRank(evaluation) <= patHighRank) {
    return [];
  }

  const rankCounts = new Map();
  hand.forEach((card) => {
    const rank = parseRank(card, { aceLow });
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  });
  const suitCounts = new Map();
  hand.forEach((card) => {
    const suit = parseSuit(card);
    if (suit) suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1);
  });
  const isFlush = suitCounts.size === 1 && hand.length >= 5;
  const sortedRanks = hand.map((card) => parseRank(card, { aceLow: false })).sort((a, b) => a - b);
  const uniqueRanks = new Set(sortedRanks);
  const isStraight =
    uniqueRanks.size >= 5 &&
    sortedRanks[sortedRanks.length - 1] - sortedRanks[0] === sortedRanks.length - 1;

  const keptRanks = new Set();
  const discardIndexes = [];
  hand.forEach((card, index) => {
    const rank = parseRank(card, { aceLow });
    const duplicated = (rankCounts.get(rank) ?? 0) > 1;
    const tooHigh = rank > drawKeepMaxRank;
    if (duplicated && keptRanks.has(rank)) {
      discardIndexes.push(index);
      return;
    }
    if (tooHigh) {
      discardIndexes.push(index);
      return;
    }
    keptRanks.add(rank);
  });

  if (penalizeStraightFlush && (isFlush || isStraight) && discardIndexes.length === 0) {
    const highestIndex = hand.reduce((bestIndex, card, index) => {
      return parseRank(card, { aceLow }) > parseRank(hand[bestIndex], { aceLow }) ? index : bestIndex;
    }, 0);
    discardIndexes.push(highestIndex);
  }

  if (discardIndexes.length === 0 && !isCleanLowEvaluation(evaluation)) {
    const highestIndex = hand.reduce((bestIndex, card, index) => {
      return parseRank(card, { aceLow }) > parseRank(hand[bestIndex], { aceLow }) ? index : bestIndex;
    }, 0);
    discardIndexes.push(highestIndex);
  }
  return [...new Set(discardIndexes)].sort((a, b) => a - b);
}

function hasBettingRoundCompleted(state) {
  const bettingPlayers = getBettingPlayers(state.players);
  if (bettingPlayers.length <= 1) return true;
  const currentBet = getCurrentBet(state);
  return bettingPlayers.every(
    (player) => player.hasActedThisRound && (player.allIn || (player.bet ?? 0) === currentBet),
  );
}

function needsBettingAction(player, currentBet = 0) {
  if (
    !player ||
    player.folded ||
    player.sittingOut ||
    player.seatOut ||
    player.isBusted ||
    player.allIn ||
    (typeof player.stack === "number" && player.stack <= 0)
  ) {
    return false;
  }
  return !player.hasActedThisRound || (player.bet ?? 0) < currentBet;
}

function getNextBettingSeat(state, fromSeatIndex) {
  const players = state.players ?? [];
  if (!players.length) return null;
  const currentBet = getCurrentBet(state);
  for (let offset = 1; offset <= players.length; offset += 1) {
    const seatIndex = (fromSeatIndex + offset) % players.length;
    const player = players[seatIndex];
    if (needsBettingAction(player, currentBet)) return seatIndex;
  }
  return null;
}

function normalizePotEligibleSeats(pot = {}, players = []) {
  if (Array.isArray(pot.eligibleSeats)) return [...pot.eligibleSeats];
  if (Array.isArray(pot.eligible)) return [...pot.eligible];
  if (Array.isArray(pot.eligiblePlayerIds)) {
    return pot.eligiblePlayerIds
      .map((id) => players.findIndex((player) => player?.playerId === id || player?.id === id))
      .filter((idx) => idx >= 0);
  }
  return getActivePlayers(players).map((player) => player.seatIndex);
}

function splitAmount(amount, winnerCount) {
  const base = Math.floor(amount / winnerCount);
  let remainder = amount % winnerCount;
  return Array.from({ length: winnerCount }, () => {
    const payout = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return payout;
  });
}

function formatLowRanksLabel(evaluation) {
  const ranks = evaluation?.metadata?.ranks;
  return Array.isArray(ranks) && ranks.length ? ranks.join("-") : "";
}

export class DeuceToSevenTripleDrawEngine extends DrawEngineBase {
  constructor({
    deckManager = null,
    gameId = "deuce_to_seven_triple_draw",
    displayName = "2-7 Triple Draw",
    variantId = "D01",
    evaluatorTag = "low-27",
    lowType = "27",
    cpuStrategy = "ruleBasedD01",
    maxDrawRounds = 3,
    bigBetStartsAtDrawRound = maxDrawRounds === 1 ? 1 : 2,
    handCardCount = 5,
  } = {}) {
    super({ gameId, displayName, maxDrawRounds });
    this.variantId = variantId;
    this.evaluatorTag = evaluatorTag;
    this.lowType = lowType;
    this.cpuStrategy = cpuStrategy;
    this.bigBetStartsAtDrawRound = bigBetStartsAtDrawRound;
    this.handCardCount = handCardCount;
    this.drawHeuristic = {
      aceLow: lowType === "A5" || lowType === "a5",
      penalizeStraightFlush: !(lowType === "A5" || lowType === "a5"),
      patHighRank: DEFAULT_PAT_HIGH_RANK,
      raiseHighRank: DEFAULT_RAISE_HIGH_RANK,
      drawKeepMaxRank: DEFAULT_DRAW_KEEP_MAX_RANK,
      weakLateDrawRound: 3,
    };
    this.deckManager = deckManager ?? new DeckManager();
  }

  getDeckManager() {
    if (!this.deckManager) {
      this.deckManager = new DeckManager();
    }
    return this.deckManager;
  }

  initHand(ctx = {}) {
    const deckManager = this.getDeckManager();
    deckManager.reset?.();
    const dealtCards = [];
    const players = createPlayers(ctx).map((player) => {
      if (player.sittingOut) return player;
      const hand = deckManager.draw(this.handCardCount, { activeCards: dealtCards });
      dealtCards.push(...hand);
      return {
        ...player,
        hand,
      };
    });

    return createTableState({
      handId: ctx.handId,
      gameId: this.id,
      engineId: this.id,
      players,
      dealerIndex: ctx.dealerIndex ?? 0,
      smallBlind: ctx.structure?.sb ?? 10,
      bigBlind: ctx.structure?.bb ?? 20,
      ante: ctx.structure?.ante ?? 0,
      street: "BET",
      drawRoundIndex: 0,
      actingPlayerIndex: null,
      lastAggressorIndex: null,
      pots: [],
      metadata: {
        variantId: this.variantId,
        bettingStructure: "fixed-limit",
        evaluator: this.evaluatorTag,
        maxDrawRounds: this.maxDrawRounds,
        handCardCount: this.handCardCount,
        smallBetBB: 1,
        bigBetBB: 2,
        bigBetStartsAtDrawRound: this.bigBetStartsAtDrawRound,
        raiseCap: 4,
        pendingDrawSeats: [],
        discardCountBySeat: {},
      },
    });
  }

  applyForcedBets(state) {
    const next = super.applyForcedBets(state);
    const active = next.players.filter(
      (player) =>
        player &&
        !player.folded &&
        !player.sittingOut &&
        !player.seatOut &&
        !player.isBusted &&
        (typeof player.stack !== "number" || player.stack > 0 || player.allIn),
    );
    const bbIndex = next.metadata?.lastBlinds?.bbIndex;
    const nextBettingSeat =
      typeof bbIndex === "number" ? getNextBettingSeat(next, bbIndex) : null;
    next.actingPlayerIndex = active.length ? nextBettingSeat ?? findFirstActiveSeat(next.players, 0) : null;
    next.lastAggressorIndex = typeof bbIndex === "number" ? bbIndex : null;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: Math.max(0, ...active.map((player) => player.bet ?? 0)),
      lastAggressorIndex: next.lastAggressorIndex,
    };
    return next;
  }

  applyBettingAction(state, action = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    if (state.street !== "BET") {
      throw new IllegalActionError("Betting action is only allowed during BET street", {
        street: state.street,
      });
    }

    const next = cloneTableState(state);
    const seatIndex = findSeatIndex(next, action);
    const player = next.players[seatIndex];
    const actionType = normalizeActionType(action);
    assertSeatIsActive(player, { seatIndex, actionType });
    if (next.actingPlayerIndex !== null && seatIndex !== next.actingPlayerIndex) {
      throw new IllegalActionError("Betting action is out of turn", {
        seatIndex,
        actingPlayerIndex: next.actingPlayerIndex,
      });
    }

    const currentBet = getCurrentBet(next);
    const betUnit = getStreetBetUnit(next);
    const raiseCount = Number(next.metadata?.raiseCountThisRound) || 0;
    let nextCurrentBet = currentBet;
    let nextRaiseCount = raiseCount;

    switch (actionType) {
      case "FOLD": {
        player.folded = true;
        player.hasActedThisRound = true;
        player.lastAction = "Fold";
        break;
      }
      case "CHECK": {
        if ((player.bet ?? 0) !== currentBet) {
          throw new IllegalActionError("Cannot check facing a bet", { seatIndex, currentBet });
        }
        player.hasActedThisRound = true;
        player.lastAction = "Check";
        break;
      }
      case "CALL": {
        const toCall = Math.max(0, currentBet - (player.bet ?? 0));
        const paid = applyChips(player, toCall);
        player.bet = (player.bet ?? 0) + paid;
        player.hasActedThisRound = true;
        player.lastAction = paid > 0 ? "Call" : "Check";
        if (player.stack === 0) player.allIn = true;
        break;
      }
      case "BET":
      case "RAISE": {
        if (raiseCount >= getRaiseCap(next)) {
          throw new IllegalActionError("Fixed-limit raise cap reached", {
            seatIndex,
            raiseCount,
            raiseCap: getRaiseCap(next),
          });
        }
        const targetBet = currentBet + betUnit;
        const toPay = Math.max(0, targetBet - (player.bet ?? 0));
        if (toPay <= 0) {
          throw new IllegalActionError("Raise target must exceed current bet", { seatIndex });
        }
        const paid = applyChips(player, toPay);
        player.bet = (player.bet ?? 0) + paid;
        player.hasActedThisRound = true;
        if (player.stack === 0) player.allIn = true;
        const fullFixedLimitRaise = player.bet >= targetBet;
        player.lastAction = fullFixedLimitRaise
          ? currentBet > 0
            ? "Raise"
            : "Bet"
          : player.bet > currentBet
          ? "All-in"
          : paid > 0
          ? "Call"
          : "Check";
        if (fullFixedLimitRaise) {
          nextCurrentBet = Math.max(currentBet, player.bet ?? 0);
          nextRaiseCount += 1;
          next.lastAggressorIndex = seatIndex;
          next.players = next.players.map((entry, idx) =>
            idx === seatIndex || entry.folded || entry.sittingOut || entry.allIn
              ? entry
              : { ...entry, hasActedThisRound: false },
          );
        }
        break;
      }
      default:
        throw new IllegalActionError(`${this.id}: unsupported betting action`, { actionType });
    }

    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: nextCurrentBet,
      betUnit,
      raiseCountThisRound: nextRaiseCount,
      lastBettingAction: {
        seatIndex,
        type: actionType,
        drawRoundIndex: next.drawRoundIndex ?? 0,
      },
    };

    const active = getActivePlayers(next.players);
    if (active.length === 1) {
      return this.resolveFoldWin(next);
    }
    if (hasBettingRoundCompleted(next)) {
      return this.advanceAfterBet(next);
    }
    next.actingPlayerIndex = getNextBettingSeat(next, seatIndex);
    return next;
  }

  advanceAfterBet(state) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    const next = cloneTableState(state);
    const { players, pots, committed } = settleCurrentBets(next);
    next.players = players;
    next.pots = pots;

    const nextDrawRound = (next.drawRoundIndex ?? 0) + 1;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: 0,
      raiseCountThisRound: 0,
      lastCommittedToPot: committed,
      potAmount: pots.reduce((sum, pot) => sum + Math.max(0, pot.amount ?? 0), 0),
    };

    if (nextDrawRound > this.maxDrawRounds) {
      return this.resolveShowdown(next).state;
    }

    return this.transitionToDraw(next, nextDrawRound);
  }

  transitionToDraw(state, drawRoundIndex = this.getNextDrawRound(state)) {
    const next = cloneTableState(state);
    next.street = "DRAW";
    next.drawRoundIndex = drawRoundIndex;
    next.players = next.players.map((player) => {
      const canDraw = !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted;
      return {
        ...player,
        hasDrawn: !canDraw,
        canDraw,
        hasActedThisRound: !canDraw,
      };
    });
    next.actingPlayerIndex = findFirstDrawableSeat(next.players, (next.dealerIndex ?? 0) + 1);
    next.metadata = {
      ...(next.metadata ?? {}),
      pendingDrawSeats: getDrawableSeatIndexes(next.players),
      discardCountBySeat: {},
    };
    return next;
  }

  transitionToBet(state) {
    const next = cloneTableState(state);
    next.street = "BET";
    next.players = next.players.map((player) => ({
      ...player,
      bet: 0,
      hasActedThisRound: player.folded || player.sittingOut || player.allIn,
      canDraw: false,
    }));
    next.actingPlayerIndex = findFirstActiveSeat(next.players, (next.dealerIndex ?? 0) + 1);
    next.lastAggressorIndex = null;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: 0,
      betUnit: getStreetBetUnit(next),
      raiseCountThisRound: 0,
      pendingDrawSeats: [],
    };
    if (next.actingPlayerIndex == null) {
      return this.advanceAfterBet(next);
    }
    return next;
  }

  applyPlayerAction(state, action = {}) {
    const actionType = normalizeActionType(action);
    if (actionType === "DRAW") {
      return this.applyDrawAction(state, action);
    }
    return this.applyBettingAction(state, { ...action, type: actionType });
  }

  applyDrawAction(state, action = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    if (state.street !== "DRAW") {
      throw new IllegalActionError("DRAW action is only allowed during DRAW street", {
        street: state.street,
      });
    }

    const next = cloneTableState(state);
    const seatIndex = findSeatIndex(next, action);
    const player = next.players[seatIndex];
    assertSeatIsActive(player, { seatIndex, actionType: "DRAW" });
    if (player.folded || player.sittingOut || player.seatOut || player.isBusted || player.canDraw === false) {
      throw new IllegalActionError("Seat cannot draw in the current round", { seatIndex });
    }
    if (next.actingPlayerIndex !== null && seatIndex !== next.actingPlayerIndex) {
      throw new IllegalActionError("DRAW action is out of turn", {
        seatIndex,
        actingPlayerIndex: next.actingPlayerIndex,
      });
    }
    if (player.hasDrawn) {
      throw new IllegalActionError("Seat has already drawn this round", { seatIndex });
    }

    const handBefore = [...(player.hand ?? [])];
    let normalizedAction;
    try {
      normalizedAction = normalizeCoreDrawAction({
        action,
        player,
        state: {
          ...next,
          maxDiscardCount: this.handCardCount,
          handCardCount: this.handCardCount,
        },
        variant: { handCardCount: this.handCardCount },
      });
    } catch (error) {
      throw new IllegalActionError(error?.message ?? "Invalid DRAW action", {
        ...(error?.meta ?? {}),
        seatIndex,
      });
    }
    const discardIndexes = normalizedAction.discardIndexes;
    const discardedCards = discardIndexes.map((idx) => handBefore[idx]);
    const keptCards = handBefore.filter((_, idx) => !discardIndexes.includes(idx));
    if (discardedCards.length) {
      this.getDeckManager().discard(discardedCards);
    }
    const replacementCards = this.getDeckManager().draw(discardedCards.length, {
      activeCards: getCardsInPlay(next.players).filter((card) => !discardedCards.includes(card)),
    });
    player.hand = [...keptCards, ...replacementCards];
    player.hasDrawn = true;
    player.hasActedThisRound = true;
    player.lastDrawCount = discardedCards.length;
    player.lastDiscardIndexes = [...discardIndexes];
    player.lastAction = discardedCards.length === 0 ? "Pat" : `DRAW(${discardedCards.length})`;

    const pendingDrawSeats = getDrawableSeatIndexes(next.players).filter(
      (idx) => !next.players[idx]?.hasDrawn,
    );
    next.metadata = {
      ...(next.metadata ?? {}),
      pendingDrawSeats,
      discardCountBySeat: {
        ...(next.metadata?.discardCountBySeat ?? {}),
        [seatIndex]: discardedCards.length,
      },
      lastDrawAction: {
        seatIndex,
        discardIndexes,
        drawIndexes: discardIndexes,
        drawCount: discardIndexes.length,
        beforeHand: handBefore,
        afterHand: [...player.hand],
        discardedCards,
        discarded: discardedCards,
        keptCards,
        replacementCards,
        drawn: replacementCards,
        warnings: normalizedAction.drawNormalization?.warnings ?? [],
        drawRoundIndex: next.drawRoundIndex ?? 0,
      },
    };

    if (!pendingDrawSeats.length) {
      return this.transitionToBet(next);
    }
    next.actingPlayerIndex = pendingDrawSeats[0];
    return next;
  }

  evaluateShowdownHand(cards = []) {
    const evaluation = evaluateLowHand({ cards, lowType: this.lowType });
    return {
      ...evaluation,
      handName: formatLowHandLabel(evaluation, { lowType: this.lowType }),
    };
  }

  chooseCpuAction(state, seatIndex = state?.actingPlayerIndex) {
    const player = state?.players?.[seatIndex];
    if (!state || typeof seatIndex !== "number" || !player || player.folded || player.sittingOut) {
      return null;
    }
    if (state.actingPlayerIndex !== null && state.actingPlayerIndex !== seatIndex) {
      return null;
    }
    const evaluation = this.evaluateShowdownHand(player.hand ?? []);
    const drawIndexes = getDrawIndexesForLowball(player.hand ?? [], evaluation, this.drawHeuristic);
    const drawCount = drawIndexes.length;
    const highestRank = getHighestLowRank(evaluation);
    const cleanLow = isCleanLowEvaluation(evaluation);

    if (state.street === "DRAW") {
      return {
        seatIndex,
        type: "DRAW",
        discardIndexes: drawIndexes,
        metadata: {
          strategy: this.cpuStrategy,
          drawCount,
          pat: drawCount === 0,
          highestRank,
        },
      };
    }

    if (state.street !== "BET") return null;
    const currentBet = getCurrentBet(state);
    const playerBet = player.bet ?? 0;
    const facingBet = currentBet > playerBet;
    const raiseCount = Number(state.metadata?.raiseCountThisRound) || 0;
    const canRaise = (player.stack ?? 0) > 0 && raiseCount < getRaiseCap(state);
    const strongPat = cleanLow && highestRank <= this.drawHeuristic.raiseHighRank;
    const strongOneDraw = drawCount <= 1 && highestRank <= this.drawHeuristic.patHighRank;
    const weakLateDraw =
      drawCount >= 3 &&
      (state.drawRoundIndex ?? 0) >= (this.drawHeuristic.weakLateDrawRound ?? 3) &&
      highestRank > (this.drawHeuristic.patHighRank ?? 8);

    if (canRaise && (strongPat || (!facingBet && strongOneDraw))) {
      return {
        seatIndex,
        type: currentBet > 0 ? "RAISE" : "BET",
        metadata: {
          strategy: this.cpuStrategy,
          drawCount,
          highestRank,
          raiseReason: strongPat ? "strongPat" : "strongOneDraw",
        },
      };
    }
    if (facingBet) {
      return {
        seatIndex,
        type: weakLateDraw ? "FOLD" : "CALL",
        metadata: {
          strategy: this.cpuStrategy,
          drawCount,
          highestRank,
          foldReason: weakLateDraw ? "weakLateDraw" : undefined,
        },
      };
    }
    return {
      seatIndex,
      type: "CHECK",
      metadata: {
        strategy: this.cpuStrategy,
        drawCount,
        highestRank,
      },
    };
  }

  resolveFoldWin(state) {
    const next = cloneTableState(state);
    const active = getActivePlayers(next.players);
    const winner = active[0];
    const winnerIndex = winner?.seatIndex;
    const { players, pots, committed } = settleCurrentBets(next);
    next.players = players;
    next.pots = pots;
    const totalPot = pots.reduce((sum, pot) => sum + Math.max(0, pot.amount ?? 0), 0);
    const payouts = [];
    if (winner && typeof winnerIndex === "number" && totalPot > 0) {
      const target = next.players[winnerIndex];
      const stackBefore = target.stack ?? 0;
      target.stack = stackBefore + totalPot;
      target.lastAction = `Collect ${totalPot}`;
      payouts.push({
        seatIndex: winnerIndex,
        name: target.name,
        payout: totalPot,
        stackBefore,
        stackAfter: target.stack,
      });
    }
    next.street = "SHOWDOWN";
    next.isHandOver = true;
    next.actingPlayerIndex = null;
    next.pots = [];
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: 0,
      lastCommittedToPot: committed,
      potAmount: 0,
      showdownTotal: totalPot,
      showdownSummary: [
        {
          potIndex: 0,
          potAmount: totalPot,
          payouts,
          winType: "fold",
        },
      ],
    };
    return next;
  }

  resolveShowdown(state, { cloneState = true } = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required for showdown");
    }
    const working = cloneState ? cloneTableState(state) : state;
    if ((working.players ?? []).some((player) => (player.bet ?? 0) > 0)) {
      const settled = settleCurrentBets(working);
      working.players = settled.players;
      working.pots = settled.pots;
    }
    if (!working.pots?.length) {
      const committed = working.players.reduce(
        (sum, player) => sum + Math.max(0, player.totalInvested ?? 0),
        0,
      );
      if (committed > 0) {
        working.pots = [
          {
            amount: committed,
            eligiblePlayerIds: getActivePlayers(working.players).map(
              (player) => player.playerId ?? player.id,
            ),
          },
        ];
      }
    }

    const summary = [];
    let totalPot = 0;
    const evaluations = working.players.map((player, seatIndex) => {
      if (!player || player.folded || player.sittingOut) return null;
      return {
        seatIndex,
        name: player.name,
        evaluation: this.evaluateShowdownHand(player.hand ?? []),
      };
    });

    (working.pots ?? []).forEach((pot, potIndex) => {
      const amount = Math.max(0, pot.amount ?? 0);
      totalPot += amount;
      const eligibleSeats = normalizePotEligibleSeats(pot, working.players).filter((seatIndex) => {
        const player = working.players[seatIndex];
        return player && !player.folded && !player.sittingOut;
      });
      const contenders = eligibleSeats
        .map((seatIndex) => evaluations[seatIndex])
        .filter((entry) => entry?.evaluation?.isValid);
      if (!amount || !contenders.length) {
        summary.push({ potIndex, potAmount: amount, payouts: [], evaluations: contenders });
        return;
      }
      const bestEvaluation = contenders.reduce((best, entry) => {
        if (!best) return entry.evaluation;
        return compareEvaluations(entry.evaluation, best) < 0 ? entry.evaluation : best;
      }, null);
      const winners = contenders.filter(
        (entry) => compareEvaluations(entry.evaluation, bestEvaluation) === 0,
      );
      const shares = splitAmount(amount, winners.length);
      const payouts = winners.map((winnerEntry, idx) => {
        const player = working.players[winnerEntry.seatIndex];
        const stackBefore = player.stack ?? 0;
        const payout = shares[idx];
        player.stack = stackBefore + payout;
        player.lastAction = `Collect ${payout}`;
        return {
          seatIndex: winnerEntry.seatIndex,
          name: player.name,
          payout,
          stackBefore,
          stackAfter: player.stack,
          handName: winnerEntry.evaluation.handName,
          handLabel: winnerEntry.evaluation.handName,
          ranksLabel: formatLowRanksLabel(winnerEntry.evaluation),
          finalLowRanks: Array.isArray(winnerEntry.evaluation.metadata?.ranks)
            ? [...winnerEntry.evaluation.metadata.ranks]
            : [],
          hand: Array.isArray(player.hand) ? [...player.hand] : [],
          evaluation: winnerEntry.evaluation,
        };
      });
      summary.push({
        potIndex,
        potAmount: amount,
        payouts,
        evaluations: contenders,
      });
    });

    working.street = "SHOWDOWN";
    working.isHandOver = true;
    working.actingPlayerIndex = null;
    working.pots = [];
    working.players = working.players.map((player) => ({
      ...player,
      bet: 0,
      hasActedThisRound: false,
      canDraw: false,
    }));
    working.metadata = {
      ...(working.metadata ?? {}),
      currentBet: 0,
      potAmount: 0,
      showdownSummary: summary,
      showdownTotal: totalPot,
      evaluations,
    };

    return {
      state: working,
      summary,
      totalPot,
    };
  }
}
