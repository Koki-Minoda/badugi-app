import NLHGameController from "../nlh/NLHGameController.js";
import { createDramahaGameDefinition } from "./DramahaGameDefinition.js";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
  getDramahaVariantConfig,
} from "./utils/dramahaEvaluator.js";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  summarizePayouts,
} from "../core/sidePotResolver.js";

const VARIANT_IDS = {
  dramaha_hi: { id: "game-dramaha-hi", label: "Dramaha Hi" },
  dramaha_27: { id: "game-dramaha-27", label: "Dramaha 2-7" },
  dramaha_a5: { id: "game-dramaha-a5", label: "Dramaha A-5" },
  dramaha_zero: { id: "game-dramaha-zero", label: "Dramaha Zero" },
  dramaha_hidugi: { id: "game-dramaha-hidugi", label: "Dramaha Hidugi" },
  dramaha_badugi: { id: "game-dramaha-badugi", label: "Dramaha Badugi" },
};

function normalizeDiscardIndexes(indexes = [], handLength = 5) {
  return [...new Set(indexes)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < handLength)
    .slice(0, handLength);
}

export class DramahaGameController extends NLHGameController {
  constructor(options = {}) {
    const variant = options.variant ?? "dramaha_hi";
    const meta = VARIANT_IDS[variant] ?? VARIANT_IDS.dramaha_hi;
    super({
      ...options,
      gameDefinition: options.gameDefinition ??
        createDramahaGameDefinition({
          id: meta.id,
          label: meta.label,
          variant,
        }),
    });
    this.variant = variant;
    this.holeCardCount = 5;
  }

  dealHoleCards(players) {
    const activeSeats = players.filter((player) => !player.folded && !player.seatOut);
    for (let round = 0; round < this.holeCardCount; round += 1) {
      activeSeats.forEach((player) => {
        const [card] = this.drawCards(1);
        if (card) {
          player.holeCards = player.holeCards ? [...player.holeCards, card] : [card];
        }
      });
    }
  }

  getSnapshot() {
    const snapshot = super.getSnapshot();
    const phase = this.state.street === "DRAW"
      ? "DRAW"
      : this.state.street === "SHOWDOWN"
      ? "SHOWDOWN"
      : "BET";
    return {
      ...snapshot,
      phase,
      drawRound: this.state.street === "DRAW" ? 0 : snapshot.drawRound,
      drawRoundIndex: this.state.street === "DRAW" ? 0 : snapshot.drawRoundIndex,
      variant: this.variant,
      variantLabel: getDramahaVariantConfig(this.variant).label,
    };
  }

  applyPlayerAction({ seatIndex, action, amount = 0, metadata = {} } = {}) {
    const actionName = String(action ?? "").toLowerCase();
    if (actionName === "draw") {
      return this.applyDrawAction({ seatIndex, metadata });
    }
    return super.applyPlayerAction({ seatIndex, action, amount });
  }

  applyDrawAction({ seatIndex, metadata = {} } = {}) {
    if (this.state.street !== "DRAW") {
      return { success: false, reason: "Not in draw street" };
    }
    const player = this.state.players[seatIndex];
    if (!player || player.folded || player.seatOut || player.allIn) {
      return { success: false, reason: "Player cannot draw" };
    }
    const hand = Array.isArray(player.holeCards) ? [...player.holeCards] : [];
    const discardIndexes = normalizeDiscardIndexes(
      metadata.discardIndexes ?? metadata.drawIndexes ?? [],
      hand.length,
    );
    discardIndexes.forEach((idx) => {
      const [newCard] = this.drawCards(1);
      if (newCard) {
        hand[idx] = newCard;
      }
    });
    player.holeCards = hand;
    player.hand = hand;
    player.hasDrawn = true;
    player.hasActedThisStreet = true;
    player.lastDrawCount = discardIndexes.length;
    player.lastAction = discardIndexes.length === 0 ? "Pat" : `DRAW(${discardIndexes.length})`;
    this.state.players[seatIndex] = { ...player };

    if (this.isDrawRoundComplete()) {
      this.advanceStreet();
    } else {
      this.state.currentActor = this.nextActiveSeat(seatIndex);
    }
    return { success: true, player: { ...player, holeCards: [...hand] } };
  }

  isDrawRoundComplete() {
    return this.state.players
      .filter((player) => player && !player.folded && !player.seatOut && !player.allIn)
      .every((player) => player.hasDrawn === true);
  }

  advanceStreet() {
    const nextStreet = this.getNextStreet(this.state.street);
    if (nextStreet === this.state.street) {
      return this.getSnapshot();
    }
    if (nextStreet === "FLOP") {
      this.state.boardCards = [...this.state.boardCards, ...this.drawCards(3)];
      this.resetStreetBets();
      this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex);
    } else if (nextStreet === "DRAW") {
      this.state.players = this.state.players.map((player) => ({
        ...player,
        hasDrawn: false,
        hasActedThisStreet: false,
      }));
      this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex);
    } else if (nextStreet === "FINAL") {
      this.resetStreetBets();
      this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex);
    } else if (nextStreet === "SHOWDOWN") {
      this.state.currentActor = null;
    }
    this.state.street = nextStreet;
    return this.getSnapshot();
  }

  getNextStreet(currentStreet) {
    switch (currentStreet) {
      case "PREFLOP":
        return "FLOP";
      case "FLOP":
        return "DRAW";
      case "DRAW":
        return "FINAL";
      case "FINAL":
        return "SHOWDOWN";
      default:
        return "PREFLOP";
    }
  }

  resolveShowdown({ totalPot = null } = {}) {
    if (this.state.street !== "SHOWDOWN") {
      this.state.street = "SHOWDOWN";
    }
    const contenders = this.state.players.filter(
      (player) =>
        player &&
        !player.folded &&
        !player.seatOut &&
        Array.isArray(player.holeCards) &&
        player.holeCards.length >= 5,
    );
    const evaluations = contenders.map((player) => ({
      player,
      evaluation: evaluateDramahaHand({
        holeCards: player.holeCards,
        boardCards: this.state.boardCards,
        variant: this.variant,
      }),
    }));
    const resolvedPot = totalPot ?? this.calculatePot();
    if (evaluations.length === 0) {
      const summary = {
        handId: this.state.handId,
        board: [...this.state.boardCards],
        totalPot: resolvedPot,
        splitMode: "boardAndDraw",
        winners: [],
        potDetails: [],
      };
      this.state.lastHandResult = summary;
      return summary;
    }
    const contributionPots = buildContributionPots(this.state.players);
    const potsToResolve = contributionPots.length
      ? contributionPots
      : [{
          potIndex: 0,
          amount: resolvedPot,
          potAmount: resolvedPot,
          eligibleSeatIndexes: evaluations.map((entry) => entry.player.seatIndex),
        }];
    const allPayouts = [];
    const potDetails = [];
    potsToResolve.forEach((pot, sourcePotIndex) => {
      const componentAmounts = [
        {
          component: "board",
          label: "Board half",
          amount: Math.floor(pot.amount / 2),
          compare: compareDramahaBoard,
        },
        {
          component: "draw",
          label: "Draw half",
          amount: pot.amount - Math.floor(pot.amount / 2),
          compare: compareDramahaDraw,
        },
      ];
      componentAmounts.forEach((component) => {
        const payouts = resolveEvaluationPot({
          amount: component.amount,
          eligibleSeatIndexes: pot.eligibleSeatIndexes,
          evaluations,
          compareEvaluations: component.compare,
        });
        allPayouts.push(
          ...payouts.map((payout) => ({
            ...payout,
            [`${component.component}Win`]: true,
          })),
        );
        potDetails.push({
          potIndex: potDetails.length,
          sourcePotIndex: pot.potIndex ?? sourcePotIndex,
          component: component.component,
          label: sourcePotIndex === 0 ? component.label : `Side ${sourcePotIndex} ${component.label}`,
          amount: component.amount,
          potAmount: component.amount,
          eligibleSeatIndexes: [...(pot.eligibleSeatIndexes ?? [])],
          winnerSeatIndexes: payouts.map((winner) => winner.player.seatIndex),
          winners: payouts.map((winner) => ({
            seatIndex: winner.player.seatIndex,
            name: winner.player.name,
            payout: winner.payout,
            evaluation: winner.evaluation,
            boardWin: component.component === "board",
            drawWin: component.component === "draw",
          })),
        });
      });
    });
    applyPayoutsToPlayers(this.state.players, allPayouts);
    const winners = summarizePayouts(allPayouts).map((winner) => ({
      ...winner,
      boardWin: allPayouts.some(
        (entry) => entry.player?.seatIndex === winner.seatIndex && entry.boardWin,
      ),
      drawWin: allPayouts.some(
        (entry) => entry.player?.seatIndex === winner.seatIndex && entry.drawWin,
      ),
    }));
    const summary = {
      handId: this.state.handId,
      board: [...this.state.boardCards],
      totalPot: resolvedPot,
      splitMode: "boardAndDraw",
      winners,
      potDetails,
    };
    this.state.lastHandResult = summary;
    return summary;
  }
}

export default DramahaGameController;
