import { GameEngine } from "./gameEngine.js";
import { cloneTableState } from "./models.js";
import { applyChips } from "./applyChips.js";

function isBlindEligible(seat) {
  if (!seat) return false;
  if (seat.sittingOut || seat.seatOut || seat.isBusted) return false;
  if (seat.seatType && String(seat.seatType).toUpperCase() === "EMPTY") return false;
  if (typeof seat.stack === "number" && seat.stack <= 0) return false;
  return true;
}

function nextBlindSeat(players = [], startIdx = 0, excludeIdx = null) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const total = players.length;
  for (let offset = 0; offset < total; offset += 1) {
    const idx = (startIdx + offset + total) % total;
    if (idx === excludeIdx) continue;
    if (isBlindEligible(players[idx])) return idx;
  }
  return null;
}

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
    const sbIdx = nextBlindSeat(next.players, (next.dealerIndex + 1) % next.players.length);
    const bbIdx = nextBlindSeat(
      next.players,
      ((sbIdx ?? next.dealerIndex) + 1) % next.players.length,
      sbIdx,
    );
    const applyBlind = (seatIdx, amount, label) => {
      if (seatIdx == null) return;
      const seat = next.players[seatIdx];
      if (!isBlindEligible(seat)) return;
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

  nextStreet(currentStreet) {
    const idx = this.boardStreetOrder.indexOf(currentStreet);
    if (idx === -1) return this.boardStreetOrder[0];
    return this.boardStreetOrder[Math.min(idx + 1, this.boardStreetOrder.length - 1)];
  }

  applyPlayerAction(/* state, action */) {
    throw new Error(`${this.id}: board engine action handler not implemented`);
  }
}
