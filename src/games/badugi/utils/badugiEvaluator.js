// src/games/badugi/utils/badugiEvaluator.js

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RVAL = Object.fromEntries(RANKS.map((r, i) => [r, i + 1])); // A=1 ... K=13

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
  const ranksAsc = [...best.key].sort((a, b) => a - b); // 小さい順（A=1）
  const base = (4 - best.size) * 1e8;
  const score = base +
    (ranksAsc[0] ?? 0) * 1_000_000 +
    (ranksAsc[1] ?? 0) * 10_000 +
    (ranksAsc[2] ?? 0) * 100 +
    (ranksAsc[3] ?? 0);

  return {
    size: best.size,
    cards: best.cards,
    ranks: ranksAsc, // ←ここも昇順に統一
    score,           // 小さいほど強い
  };
}



/** 2ハンド比較
 * Aが強ければ負、Bが強ければ正、同点なら0を返す
 * （sort関数などでも使える）
 */
/** 2ハンド比較（Aが強ければ負） */
export function compareBadugi(handA, handB) {
  const evA = evaluateBadugi(handA);
  const evB = evaluateBadugi(handB);

  // 1️⃣ Badugi枚数
  if (evA.size !== evB.size) {
    return evA.size > evB.size ? -1 : 1; // 大きい方が強い
  }

  // 2️⃣ ランク比較（A=1が最強）
  for (let i = 0; i < Math.min(evA.ranks.length, evB.ranks.length); i++) {
    if (evA.ranks[i] !== evB.ranks[i]) {
      return evA.ranks[i] < evB.ranks[i] ? -1 : 1;
    }
  }

  // 3️⃣ 完全一致のみチョップ
  const same = evA.cards.length === evB.cards.length &&
               evA.cards.every(c => evB.cards.includes(c));
  return same ? 0 : evA.score < evB.score ? -1 : 1;
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

  // 各プレイヤーを評価
  const evaluated = players.map(p => ({
    ...p,
    eval: evaluateBadugi(p.hand),
  }));

  // Badugiルール：枚数 > ランク(昇順)
  evaluated.sort((a, b) => {
    if (a.eval.size !== b.eval.size) return b.eval.size - a.eval.size; // 大きい方が強い
    const len = Math.min(a.eval.ranks.length, b.eval.ranks.length);
    for (let i = len - 1; i >= 0; i--) {
      if (a.eval.ranks[i] !== b.eval.ranks[i])
        return a.eval.ranks[i] - b.eval.ranks[i]; // 小さいカード（=強い）が勝ち
    }
    return 0;
  });

  const best = evaluated[0];
  const winners = evaluated.filter(
    p =>
      p.eval.size === best.eval.size &&
      p.eval.ranks.length === best.eval.ranks.length &&
      p.eval.ranks.every((r, i) => r === best.eval.ranks[i])
  );

  // 🧩 デバッグ出力
  console.log("[SHOWDOWN] Evaluated order:", evaluated.map(p =>
    `${p.name} size=${p.eval.size} ranks=${p.eval.ranks.join("-")}`));
  console.log("[SHOWDOWN] Winners:", winners.map(p => p.name));

  return winners;
}




