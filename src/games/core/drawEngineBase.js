import { GameEngine } from "./gameEngine.js";
import { cloneTableState } from "./models.js";

/**
 * Utility base class for draw games (Badugi, 2-7, Dramahaなど)。
 * ここでは汎用的な SB/BB 処理や「全員がマッチしたか」の判定だけ提供し、
 * 実際のアクション処理は派生クラスで実装する。
 */
export class DrawEngineBase extends GameEngine {
  constructor(opts = {}) {
    super(opts);
    this.maxDrawRounds = opts.maxDrawRounds ?? 3;
  }

  applyForcedBets(state) {
    const next = cloneTableState(state);
    const anteValue = next.ante ?? 0;
    if (anteValue > 0) {
      next.players.forEach((seat) => {
        if (!seat || seat.sittingOut) return;
        const pay = Math.min(seat.stack, anteValue);
        seat.stack -= pay;
        seat.bet = (seat.bet ?? 0) + pay;
        seat.totalInvested = (seat.totalInvested ?? 0) + pay;
        seat.lastAction = "ANTE";
        if (seat.stack === 0) seat.allIn = true;
      });
    }
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

  /**
   * 共通の「全員マッチしたか」判定。派生クラスでベットサイズを判定したい場合に利用。
   */
  shouldAdvanceStreet(state) {
    const active = state.players.filter((p) => !p.folded && !p.sittingOut);
    if (active.length === 0) {
      return true;
    }
    const maxBet = Math.max(...active.map((p) => p.bet ?? 0));
    const everyoneMatched = active.every((p) => p.allIn || (p.bet ?? 0) === maxBet);
    const noOneCanAct = active.every((p) => p.allIn);
    return everyoneMatched || noOneCanAct;
  }

  getNextDrawRound(state) {
    return Math.min(this.maxDrawRounds, (state.drawRoundIndex ?? 0) + 1);
  }

  applyPlayerAction(/* state, action */) {
    throw new Error(`${this.id}: applyPlayerAction() must be implemented by concrete draw engine`);
  }
}
