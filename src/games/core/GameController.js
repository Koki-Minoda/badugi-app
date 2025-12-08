// src/games/core/GameController.js
/**
 * GameController is the variant-agnostic surface the UI interacts with.
 * Concrete controllers (Badugi, NLH, etc.) should extend this class or
 * implement the same method signatures.
 */
export class GameController {
  /**
   * @param {object} tableConfig
   * @returns {object} initialState
   */
  createInitialState(tableConfig = {}) {
    void tableConfig;
    throw new Error("createInitialState must be implemented by a concrete controller");
  }

  /**
   * @param {object} prevState
   * @param {object} options
   * @returns {object} state for the next hand
   */
  createNewHandState(prevState, options = {}) {
    void prevState;
    void options;
    throw new Error("createNewHandState must be implemented by a concrete controller");
  }

  /**
   * @param {object} state
   * @returns {object} uiSnapshot consumed by React components
   */
  getUiSnapshot(state) {
    void state;
    throw new Error("getUiSnapshot must be implemented by a concrete controller");
  }

  /**
   * @param {object} state
   * @param {number} seatIndex
   * @returns {Array<object>} list of legal actions
   */
  getLegalActions(state, seatIndex) {
    void state;
    void seatIndex;
    return [];
  }

  /**
   * @param {object} state
   * @param {object} action
   * @returns {{ state: object, events: Array<object> }}
   */
  applyAction(state, action) {
    void state;
    void action;
    return { state, events: [] };
  }

  /**
   * @param {object} state
   * @returns {boolean}
   */
  isStreetFinished(state) {
    void state;
    return false;
  }

  /**
   * @param {object} state
   * @returns {boolean}
   */
  isHandFinished(state) {
    void state;
    return false;
  }

  /**
   * @param {object} state
   * @returns {Array<object>} winner summaries
   */
  getWinners(state) {
    void state;
    return [];
  }

  /**
   * Optional RL encoding hook.
   * @param {object} state
   * @param {number} seatIndex
   * @returns {Array<number>}
   */
  encodeForRL(state, seatIndex) {
    void state;
    void seatIndex;
    return [];
  }
}

export default GameController;
