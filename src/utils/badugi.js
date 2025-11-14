// src/utils/badugi.js
// Legacy compatibility wrapper that re-exports the canonical evaluator.
import {
  evaluateBadugi,
  compareBadugi,
  getWinnersByBadugi,
} from "../games/badugi/utils/badugiEvaluator";

export { evaluateBadugi, compareBadugi, getWinnersByBadugi };

/**
 * Helper that returns winner seat indexes from a players array.
 * Preserved for modules that still rely on the older API.
 */
export function compareHands(players = []) {
  const active = players
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !p.folded);
  if (active.length === 0) return [];

  // Evaluate once and reuse the canonical compare function.
  const evaluated = active.map(({ p, idx }) => ({
    idx,
    eval: evaluateBadugi(p.hand),
  }));

  evaluated.sort((a, b) =>
    compareBadugi(players[a.idx].hand, players[b.idx].hand)
  );
  const best = evaluated[0].eval;

  return evaluated
    .filter(({ eval: ev }) => {
      if (ev.ranks.length !== best.ranks.length) return false;
      return ev.ranks.every((r, i) => r === best.ranks[i]);
    })
    .map(({ idx }) => idx);
}
