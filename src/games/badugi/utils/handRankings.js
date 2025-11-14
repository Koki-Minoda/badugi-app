// src/games/badugi/utils/handRankings.js
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "./badugiEvaluator";

/**
 * 統一的な役評価ディスパッチャ
 * @param {string} gameType - "badugi" | "holdem" | "plo" | ...
 * @param {string[]} hand - ["A♠","2♥","3♦","4♣"]
 * @returns {object} - { score: number, size, ranks } など evaluateXXX の結果
 */
export function evaluateHand(gameType, hand) {
  switch (gameType) {
    case "badugi":
      return evaluateBadugi(hand);

    // 将来的に他ゲームを追加
    // case "holdem":
    //   return evaluateHoldem(hand);
    // case "plo":
    //   return evaluatePLO(hand);

    default:
      console.warn(`[WARN] evaluateHand: Unsupported game type "${gameType}"`);
      return { rankType: "UNKNOWN", ranks: [], kicker: 0, isBadugi: false };
  }
}

/**
 * 統一的な2ハンド比較
 * Aが強ければ負、Bが強ければ正、同点なら0を返す
 */
export function compareHands(gameType, handA, handB) {
  switch (gameType) {
    case "badugi":
      return compareBadugi(handA, handB);
    // 例：将来対応
    // case "holdem": return compareHoldem(handA, handB);
    // case "plo": return comparePLO(handA, handB);
    default:
      console.warn(`[WARN] compareHands: Unsupported game type "${gameType}"`);
      return 0;
  }
}

/**
 * 複数プレイヤーから勝者を決定
 */
export function getWinners(gameType, players) {
  switch (gameType) {
    case "badugi":
      return getWinnersByBadugi(players);
    // 例：将来対応
    // case "holdem": return getWinnersByHoldem(players);
    // case "plo": return getWinnersByPLO(players);
    default:
      console.warn(`[WARN] getWinners: Unsupported game type "${gameType}"`);
      return [];
  }
}
