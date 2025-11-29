// src/ui/game/GameUIAdapter.js

/**
 * @typedef {Object} GameUIAdapter
 *
 * @property {(options: {
 *   controllerSnapshot: Object,
 *   tableConfig?: Object,
 * }) => Object} createInitialViewState
 *   Called once when the game UI is first created. Implementations may derive
 *   any view-specific caches from the initial controller snapshot.
 *
 * @property {(options: {
 *   controllerSnapshot: Object,
 *   tableConfig?: Object,
 * }) => {
 *   tablePhase: string | null,
 *   seatViews: Array<Object>,
 *   potView: Object | null,
 *   controlsConfig: Object,
 *   hudInfo: Object,
 * }} buildViewProps
 *   Produces the props that the React UI expects for the current frame.
 *
 * @property {(streetId: string) => string} [formatStreetLabel]
 *   Optional helper to convert an internal street identifier into a
 *   user-facing label (e.g., "DRAW_2" -> "Draw 2 / 3").
 *
 * @property {(evaluation: Object) => string} [formatHandLabel]
 *   Optional helper that turns a hand evaluation object into a readable label.
 *
 * @property {(options: {
 *   controllerSnapshot: Object,
 *   seatIndex: number,
 * }) => Array<string>} [getAvailableActions]
 *   Optional helper that returns the logical actions a seat can currently take.
 */

/**
 * Minimal base implementation that concrete adapters may extend.
 * None of the methods perform game-specific logic; they merely
 * provide consistent default shapes for downstream consumers.
 */
export class BaseGameUIAdapter {
  createInitialViewState({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    return {
      controllerSnapshot,
      tableConfig,
    };
  }

  buildViewProps({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    return {
      tablePhase: controllerSnapshot.phase ?? null,
      seatViews: [],
      potView: null,
      controlsConfig: {},
      hudInfo: {
        tableConfig,
      },
    };
  }

  formatStreetLabel(streetId) {
    return streetId != null ? String(streetId) : "";
  }

  formatHandLabel(evaluation) {
    if (!evaluation) return "";
    return evaluation.label ?? "";
  }

  getAvailableActions({ controllerSnapshot = {}, seatIndex } = {}) {
    void controllerSnapshot;
    void seatIndex;
    return [];
  }
}

export default BaseGameUIAdapter;
