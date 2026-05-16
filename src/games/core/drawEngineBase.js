import { GameEngine } from "./gameEngine.js";
import { cloneTableState } from "./models.js";
import { applyChips } from "./applyChips.js";

function isForcedBetEligible(seat) {
  if (!seat) return false;
  if (seat.sittingOut || seat.seatOut || seat.isBusted) return false;
  if (seat.seatType && String(seat.seatType).toUpperCase() === "EMPTY") return false;
  if (typeof seat.stack === "number" && seat.stack <= 0) return false;
  return true;
}

function nextForcedBetSeat(players = [], startIdx = 0, excludeIdx = null) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const total = players.length;
  for (let offset = 0; offset < total; offset += 1) {
    const idx = (startIdx + offset + total) % total;
    if (idx === excludeIdx) continue;
    if (isForcedBetEligible(players[idx])) return idx;
  }
  return null;
}

function countForcedBetEligibleSeats(players = []) {
  return players.reduce((count, seat) => count + (isForcedBetEligible(seat) ? 1 : 0), 0);
}

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
        if (!isForcedBetEligible(seat)) return;
        const applied = applyChips(seat, anteValue);
        seat.bet = (seat.bet ?? 0) + applied;
        seat.lastAction = "ANTE";
        if (seat.stack === 0) seat.allIn = true;
      });
    }
    const eligibleSeatCount = countForcedBetEligibleSeats(next.players);
    const headsUp = eligibleSeatCount === 2;
    const sbIdx = headsUp
      ? nextForcedBetSeat(next.players, next.dealerIndex)
      : nextForcedBetSeat(next.players, (next.dealerIndex + 1) % next.players.length);
    const bbIdx = nextForcedBetSeat(
      next.players,
      ((sbIdx ?? next.dealerIndex) + 1) % next.players.length,
      sbIdx,
    );
    const applyBlind = (seatIdx, amount, label) => {
      if (seatIdx == null) return;
      const seat = next.players[seatIdx];
      if (!isForcedBetEligible(seat)) return;
      const applied = applyChips(seat, amount);
      seat.bet = (seat.bet ?? 0) + applied;
      seat.lastAction = label;
      if (seat.stack === 0) seat.allIn = true;
    };
    applyBlind(sbIdx, next.smallBlind ?? 0, "SB");
    applyBlind(bbIdx, next.bigBlind ?? 0, "BB");
    next.metadata = {
      ...(next.metadata ?? {}),
      lastBlinds: { sbIndex: sbIdx, bbIndex: bbIdx },
    };
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
