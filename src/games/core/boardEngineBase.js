import { GameEngine } from "./gameEngine.js";
import { cloneTableState } from "./models.js";

/**
 * Base helper for flop/board games (NLH, PLO, Dramaha board partなど)。
 * 現状は forced bet と street helper だけを提供。
 */
export class BoardEngineBase extends GameEngine {
  constructor(opts = {}) {
    super(opts);
    this.boardStreetOrder = opts.boardStreetOrder ?? ["PREFLOP", "FLOP", "TURN", "RIVER"];
  }

  applyForcedBets(state) {
    const next = cloneTableState(state);
    const sbIdx = (next.dealerIndex + 1) % next.players.length;
    const bbIdx = (next.dealerIndex + 2) % next.players.length;
    const applyBlind = (seatIdx, amount, label) => {
      const seat = next.players[seatIdx];
      if (!seat || seat.sittingOut) return;
      const pay = Math.min(seat.stack, amount);
      seat.stack -= pay;
      seat.bet = (seat.bet ?? 0) + pay;
      seat.totalInvested = (seat.totalInvested ?? 0) + pay;
      seat.lastAction = label;
      if (seat.stack === 0) seat.allIn = true;
    };
    applyBlind(sbIdx, next.smallBlind ?? 0, "SB");
    applyBlind(bbIdx, next.bigBlind ?? 0, "BB");
    return next;
  }

  nextStreet(currentStreet) {
    const idx = this.boardStreetOrder.indexOf(currentStreet);
    if (idx === -1) return this.boardStreetOrder[0];
    return this.boardStreetOrder[Math.min(idx + 1, this.boardStreetOrder.length - 1)];
  }

  applyPlayerAction(/* state, action */) {
    throw new Error(`${this.id}: board engine action handler not implemented`);
  }
}
