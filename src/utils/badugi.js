// src/utils/badugi.js
// rank -> numeric (A=1, 2..10, J=11,Q=12,K=13)
const rankMap = (r) => {
  if (r === "A") return 1;
  if (r === "J") return 11;
  if (r === "Q") return 12;
  if (r === "K") return 13;
  return parseInt(r, 10);
};

// Evaluate best Badugi subset for a hand (hand usually 4 cards)
export function evaluateBadugi(hand) {
  // hand: ["A♠","5♥",...]
  const n = hand.length;
  let best = { size: 0, ranksAsc: [] }; // ranksAsc: ascending numeric ranks for tiebreak (lowest-first)

  // try all subsets
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const selected = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) selected.push(hand[i]);

    // check uniqueness of suits and ranks
    const suits = new Set();
    const ranks = new Set();
    let ok = true;
    const numeric = [];
    for (const card of selected) {
      const s = card.slice(-1);
      const r = card.slice(0, -1);
      if (suits.has(s) || ranks.has(r)) {
        ok = false;
        break;
      }
      suits.add(s);
      ranks.add(r);
      numeric.push(rankMap(r));
    }
    if (!ok) continue;

    // sort numeric ascending for tiebreak
    numeric.sort((a,b)=>a-b);
    // Larger size better; if equal, the one with lexicographically smaller reversed (compare highest first with smaller better)
    if (selected.length > best.size) {
      best = { size: selected.length, ranksAsc: numeric };
    } else if (selected.length === best.size && selected.length > 0) {
      // compare reversed arrays: compare highest card (last) first (smaller wins)
      const a = numeric.slice().reverse();
      const b = best.ranksAsc.slice().reverse();
      let cmp = 0;
      for (let i = 0; i < a.length && i < b.length; i++) {
        if (a[i] < b[i]) { cmp = -1; break; }
        if (a[i] > b[i]) { cmp = 1; break; }
      }
      if (cmp === 0 && a.length < b.length) cmp = -1;
      if (cmp === -1) best = { size: selected.length, ranksAsc: numeric };
    }
  }

  return { score: best.size, ranksAsc: best.ranksAsc };
}

// compare hands among players: return array of winner indices (in players array)
export function compareHands(players) {
  const active = players.map((p, idx) => ({ p, idx })).filter(x => !x.p.folded);
  if (active.length === 0) return [];

  const evaluated = active.map(({ p, idx }) => ({ idx, eval: evaluateBadugi(p.hand) }));
  // find max size
  const maxSize = Math.max(...evaluated.map(e => e.eval.score));
  const candidates = evaluated.filter(e => e.eval.score === maxSize);

  // if only one, winner
  if (candidates.length === 1) return [candidates[0].idx];

  // else compare ranksAsc using reversed lexicographic (highest card first, lower is better)
  candidates.sort((a,b) => {
    const ra = a.eval.ranksAsc.slice().reverse();
    const rb = b.eval.ranksAsc.slice().reverse();
    for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
      const va = ra[i] ?? 0;
      const vb = rb[i] ?? 0;
      if (va < vb) return -1; // a better (lower high card)
      if (va > vb) return 1;
    }
    return 0;
  });

  // find best value
  const bestVal = candidates[0].eval;
  const winners = candidates.filter(c => {
    // compare equality with bestVal
    const ra = c.eval.ranksAsc.slice().reverse();
    const rb = bestVal.ranksAsc.slice().reverse();
    if (ra.length !== rb.length) return false;
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return false;
    return true;
  }).map(c => c.idx);

  return winners;
}
