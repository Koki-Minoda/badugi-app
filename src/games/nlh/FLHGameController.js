import NLHGameController from "./NLHGameController.js";
import FLHGameDefinition from "./FLHGameDefinition.js";

export class FLHGameController extends NLHGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? FLHGameDefinition,
    });
    this.raiseCountThisStreet = 0;
    this.raiseCap = options.raiseCap ?? 4;
  }

  resetStreetBets() {
    super.resetStreetBets();
    this.raiseCountThisStreet = 0;
  }

  getLimitUnit() {
    const bb = this.blinds.bb ?? 2;
    return this.state.street === "TURN" || this.state.street === "RIVER" ? bb * 2 : bb;
  }

  applyPlayerAction({ seatIndex, action, amount = 0 } = {}) {
    const actionName = String(action ?? "").toLowerCase();
    if (actionName === "all-in") {
      const player = this.state.players[seatIndex];
      if (!player) return super.applyPlayerAction({ seatIndex, action, amount });
      const toCall = Math.max(0, (this.state.currentBet ?? 0) - (player.betThisStreet ?? 0));
      const raiseSize = (player.stack ?? 0) - toCall;
      if (raiseSize > this.getLimitUnit()) {
        return { success: false, reason: "All-in exceeds the fixed-limit betting unit" };
      }
      if (raiseSize > 0 && this.raiseCountThisStreet >= this.raiseCap) {
        return { success: false, reason: "Fixed-limit betting is capped" };
      }
      const previousRaiseCount = this.raiseCountThisStreet;
      if (raiseSize > 0) this.raiseCountThisStreet += 1;
      const result = super.applyPlayerAction({ seatIndex, action, amount });
      if (!result.success) this.raiseCountThisStreet = previousRaiseCount;
      return result;
    }
    if (actionName !== "bet" && actionName !== "raise") {
      return super.applyPlayerAction({ seatIndex, action, amount });
    }
    if (this.raiseCountThisStreet >= this.raiseCap) {
      return super.applyPlayerAction({ seatIndex, action: "call", amount: 0 });
    }
    const player = this.state.players[seatIndex];
    if (!player) {
      return { success: false, reason: "Player not found" };
    }
    const unit = this.getLimitUnit();
    const toCall = Math.max(0, (this.state.currentBet ?? 0) - (player.betThisStreet ?? 0));
    const commit = Math.min(player.stack ?? 0, toCall + unit);
    const previousRaiseCount = this.raiseCountThisStreet;
    this.raiseCountThisStreet += 1;
    const result = super.applyPlayerAction({ seatIndex, action, amount: commit });
    if (!result.success) this.raiseCountThisStreet = previousRaiseCount;
    return result;
  }
}

export default FLHGameController;
