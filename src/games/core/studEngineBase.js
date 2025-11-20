import { GameEngine } from "./gameEngine.js";

/**
 * Base helper for stud family (Stud, Razz, Stud8)。
 * ここでは bring-in / up-card の基本構造だけ提供し、実ロジックは派生へ委譲。
 */
export class StudEngineBase extends GameEngine {
  constructor(opts = {}) {
    super(opts);
    this.bringIn = opts.bringIn ?? 0;
  }

  /**
   * 派生クラスは bring-in 支払い / door card 判定を実装する。
   */
  applyForcedBets(/* state */) {
    throw new Error(`${this.id}: stud applyForcedBets() not implemented`);
  }

  applyPlayerAction(/* state, action */) {
    throw new Error(`${this.id}: stud applyPlayerAction() not implemented`);
  }
}
