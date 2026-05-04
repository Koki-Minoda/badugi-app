import NLHGameController from "../nlh/NLHGameController.js";
import { createDramahaGameDefinition } from "./DramahaGameDefinition.js";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
  getDramahaVariantConfig,
} from "./utils/dramahaEvaluator.js";

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
    const bestBoard = evaluations.reduce(
      (best, entry) =>
        !best || compareDramahaBoard(entry.evaluation, best.evaluation) < 0
          ? entry
          : best,
      null,
    );
    const bestDraw = evaluations.reduce(
      (best, entry) =>
        !best || compareDramahaDraw(entry.evaluation, best.evaluation) < 0
          ? entry
          : best,
      null,
    );
    const boardWinners = evaluations.filter(
      (entry) => compareDramahaBoard(entry.evaluation, bestBoard.evaluation) === 0,
    );
    const drawWinners = evaluations.filter(
      (entry) => compareDramahaDraw(entry.evaluation, bestDraw.evaluation) === 0,
    );
    const boardPot = Math.floor(resolvedPot / 2);
    const drawPot = resolvedPot - boardPot;
    const payouts = new Map();
    const award = (entries, amount) => {
      if (!entries.length || amount <= 0) return;
      const base = Math.floor(amount / entries.length);
      let remainder = amount - base * entries.length;
      entries.forEach((entry) => {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        payouts.set(entry.player.seatIndex, (payouts.get(entry.player.seatIndex) ?? 0) + base + extra);
      });
    };
    award(boardWinners, boardPot);
    award(drawWinners, drawPot);

    const winners = [...payouts.entries()].map(([seatIndex, payout]) => {
      const player = this.state.players[seatIndex];
      if (player) {
        player.stack = (player.stack ?? 0) + payout;
      }
      return {
        seatIndex,
        name: player?.name ?? `Seat ${seatIndex + 1}`,
        payout,
        boardWin: boardWinners.some((entry) => entry.player.seatIndex === seatIndex),
        drawWin: drawWinners.some((entry) => entry.player.seatIndex === seatIndex),
        evaluation: evaluations.find((entry) => entry.player.seatIndex === seatIndex)?.evaluation,
      };
    });
    const summary = {
      handId: this.state.handId,
      board: [...this.state.boardCards],
      totalPot: resolvedPot,
      splitMode: "boardAndDraw",
      winners,
      potDetails: [
        {
          potIndex: 0,
          label: "Board half",
          amount: boardPot,
          winnerSeatIndexes: boardWinners.map((entry) => entry.player.seatIndex),
        },
        {
          potIndex: 1,
          label: "Draw half",
          amount: drawPot,
          winnerSeatIndexes: drawWinners.map((entry) => entry.player.seatIndex),
        },
      ],
    };
    this.state.lastHandResult = summary;
    return summary;
  }
}

export default DramahaGameController;
