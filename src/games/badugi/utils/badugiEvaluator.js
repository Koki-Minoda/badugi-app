// src/games/badugi/utils/badugiEvaluator.js

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RVAL = Object.fromEntries(RANKS.map((r, i) => [r, i + 1])); // A=1 ... K=13

const RANK_TYPE = {
  4: "BADUGI",
  3: "THREE_CARD",
  2: "TWO_CARD",
  1: "ONE_CARD",
};

function uniqueRankSuit(cards) {
  const rs = new Set();
  const ss = new Set();
  for (const c of cards) {
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    if (rs.has(r) || ss.has(s)) return false;
    rs.add(r);
    ss.add(s);
  }
  return true;
}

function handKey(cards) {
  // 役比較用キー：ランクの数値を「高い順」に並べ、配列を小さい方が強い比較に使う
  // （= 最高位が小さいほど良い → その要素で先に小さくなる方が勝ち）
  const valsDesc = cards
    .map(c => RVAL[c.slice(0, -1)])
    .sort((a, b) => b - a); // 高い→低い
  return valsDesc;
}

function cmpKeys(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv; // 小さい方が強い
  }
  return 0;
}

function bestBadugiSubset(hand) {
  // 4→3→2→1 の順で、ランク/スーツ重複なしサブセットの中から最良を取る
  const cards = [...hand];
  for (let size = 4; size >= 1; size--) {
    let best = null;
    const m = cards.length;
    const choose = (start, acc) => {
      if (acc.length === size) {
        if (!uniqueRankSuit(acc)) return;
        const key = handKey(acc);
        if (!best || cmpKeys(key, best.key) < 0) {
          best = { cards: [...acc], key };
        }
        return;
      }
      for (let i = start; i < m; i++) {
        acc.push(cards[i]);
        choose(i + 1, acc);
        acc.pop();
      }
    };
    choose(0, []);
    if (best) return { size, cards: best.cards, key: best.key };
  }
  // 理論上ここには来ない
  return { size: 1, cards: [cards[0]], key: handKey([cards[0]]) };
}

/**
 * 役評価（小さい score ほど強い）
 * @param {string[]} hand - ["A♣","7♦","2♠","K♥"] など
 * @returns {{size:number, cards:string[], ranks:number[], score:number}}
 */
export function evaluateBadugi(hand) {
  const best = bestBadugiSubset(hand);
  const ranksAsc = [...best.key].sort((a, b) => a - b);
  const madeSize = ranksAsc.length;

  return {
    rankType: RANK_TYPE[madeSize] ?? "ONE_CARD",
    ranks: ranksAsc,
    kicker: ranksAsc[ranksAsc.length - 1] ?? 0,
    isBadugi: madeSize === 4,
  };
}




/** 2ハンド比較
 * Aが強ければ負、Bが強ければ正、同点なら0を返す
 * （sort関数などでも使える）
 */
/** 2ハンド比較（Aが強ければ負） */
export function compareBadugi(handA, handB) {
  return compareEvalResults(evaluateBadugi(handA), evaluateBadugi(handB));
}



/** 🔹 複数プレイヤーから最強1人を決定 */
export function getBestBadugiPlayer(players) {
  if (!players || players.length === 0) return null;
  let best = players[0];
  for (const p of players) {
    if (compareBadugi(p.hand, best.hand) < 0) best = p;
  }
  return best;
}

// utils/badugiEvaluator.js
export function getWinnersByBadugi(players) {
  if (!players || players.length === 0) return [];

  const evaluated = players.map(p => ({
    ...p,
    eval: evaluateBadugi(p.hand),
  }));

  evaluated.sort((a, b) => compareEvalResults(a.eval, b.eval));

  const bestEval = evaluated[0].eval;
  const winners = evaluated.filter(
    (p) => compareEvalResults(p.eval, bestEval) === 0
  );

  console.log("[SHOWDOWN] Evaluated order:", evaluated.map(p =>
    `${p.name} type=${p.eval.rankType} ranks=${p.eval.ranks.join("-")}`));
  console.log("[SHOWDOWN] Winners:", winners.map(p => p.name));

  return winners;
}

function compareEvalResults(evA, evB) {
  const sizeA = evA.ranks.length;
  const sizeB = evB.ranks.length;
  if (sizeA !== sizeB) {
    return sizeA > sizeB ? -1 : 1;
  }
  for (let i = sizeA - 1; i >= 0; i--) {
    const diff = (evA.ranks[i] ?? 0) - (evB.ranks[i] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

