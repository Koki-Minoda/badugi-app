import { cloneTableState } from "./models.js";

/**
 * Base GameEngine contract. Engines should extend this class and override
 * key lifecycle hooks. Methods throw by default so missing overrides are obvious.
 */
export class GameEngine {
  constructor({ gameId, displayName } = {}) {
    if (!gameId) throw new Error("GameEngine requires gameId");
    this.id = gameId;
    this.displayName = displayName ?? gameId;
  }

  /**
   * @returns {TableState}
   */
  initHand(/* ctx */) {
    throw new Error(`${this.id}: initHand() not implemented`);
  }

  applyForcedBets(/* state */) {
    throw new Error(`${this.id}: applyForcedBets() not implemented`);
  }

  /**
   * @param {TableState} state
   * @param {object} action { playerId, type, amount, metadata }
   */
  applyPlayerAction(/* state, action */) {
    throw new Error(`${this.id}: applyPlayerAction() not implemented`);
  }

  /**
   * Called when no further actions remain (fold or showdown).
   */
  resolveShowdown(/* state */) {
    throw new Error(`${this.id}: resolveShowdown() not implemented`);
  }

  /**
   * Called when the table needs an RL snapshot / logging payload.
   */
  getObservation(state, playerId) {
    // Default implementation returns shallow clone for compatibility
    return {
      playerId,
      state: cloneTableState(state),
    };
  }
}
