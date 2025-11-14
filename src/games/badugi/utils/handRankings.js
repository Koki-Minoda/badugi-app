// src/games/badugi/utils/handRankings.js
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "./badugiEvaluator";

/**
 * 
 * @param {string} gameType - "badugi" | "holdem" | "plo" | ...
 * @param {string[]} hand - ["A","2","3","4"]
 * @returns {object} - { score: number, size, ranks }  evaluateXXX 
 */
export function evaluateHand(gameType, hand) {
  switch (gameType) {
    case "badugi":
      return evaluateBadugi(hand);

    // 
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
 * 2
 * AB0
 */
export function compareHands(gameType, handA, handB) {
  switch (gameType) {
    case "badugi":
      return compareBadugi(handA, handB);
    // 
    // case "holdem": return compareHoldem(handA, handB);
    // case "plo": return comparePLO(handA, handB);
    default:
      console.warn(`[WARN] compareHands: Unsupported game type "${gameType}"`);
      return 0;
  }
}

/**
 * 
 */
export function getWinners(gameType, players) {
  switch (gameType) {
    case "badugi":
      return getWinnersByBadugi(players);
    // 
    // case "holdem": return getWinnersByHoldem(players);
    // case "plo": return getWinnersByPLO(players);
    default:
      console.warn(`[WARN] getWinners: Unsupported game type "${gameType}"`);
      return [];
  }
}
