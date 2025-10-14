// src/games/badugi/logic/drawRound.js
import { nextAliveFrom } from "./roundFlow";
import { debugLog } from "../../../utils/debugLog";

/**
 * DRAWラウンド制御（DeckManager対応版）
 * - デッキを deckManager インスタンスで一元管理
 * - setDeck は不要（App 側で保持しない）
 */
export function runDrawRound({
  players,
  turn,
  deckManager, 
  setPlayers,
  drawRound,
  setTurn,
  dealerIdx,
  NUM_PLAYERS,
}) {
  const actor = players?.[turn];
  if (!actor) return;

  // 既にドロー済み / 無効プレイヤーならスキップ
  if (actor.folded || actor.allIn || actor.hasDrawn) {
    debugLog(`[DRAW] skip ${actor?.name} (folded/all-in/already drawn)`);
    const next = nextAliveFrom(players, turn);
    if (next !== null) setTurn(next);
    return;
  }

  // CPUの場合：簡易ドロー数決定
  let drawCount = actor.drawRequest ?? 0;
  if (turn !== 0 && drawCount === 0) {
    drawCount = decideCpuDraw(actor.hand);
  }

  // --- デッキから安全にカードを引く ---
  const newHand = [...actor.hand];
  const discardIndexes = pickDiscardIndexes(actor.hand, drawCount);

  const drawnCards = deckManager.draw(drawCount); // ✅ DeckManager管理
  discardIndexes.forEach((idx, j) => {
    const newCard = drawnCards[j];
    newHand[idx] = newCard;
  });

  debugLog(
    `[DRAW] ${actor.name} exchanged ${drawCount} card(s) → ${newHand.join(", ")}`
  );

  // --- プレイヤー更新 ---
  const updatedPlayers = players.map((p, i) =>
    i === turn
      ? {
          ...p,
          hand: newHand,
          hasDrawn: true,
          lastDrawCount: drawCount,
          lastAction: drawCount === 0 ? "Pat" : `DRAW(${drawCount})`,
        }
      : p
  );

  setPlayers([...updatedPlayers]);

  // --- 次の未ドロー者を「SB起点の左回り」で探索 ---
  const sb = (dealerIdx + 1) % NUM_PLAYERS;
  const order = Array.from({ length: NUM_PLAYERS }, (_, k) => (sb + k) % NUM_PLAYERS);
  const nextIdx = order.find(
    (i) => !updatedPlayers[i]?.folded && !updatedPlayers[i]?.allIn && !updatedPlayers[i]?.hasDrawn
  );

  if (nextIdx !== -1) {
    setTurn(nextIdx);
  } else {
    debugLog(`[DRAW] All active players have drawn (round=${drawRound}).`);
    // App 側の finishDrawRound() がBETへ遷移する
  }
}

/** CPUの簡易ドローロジック（重複スーツ/ランクの数だけ最大3枚） */
function decideCpuDraw(hand) {
  const suits = new Set();
  const ranks = new Set();
  for (const card of hand) {
    const s = card.slice(-1);
    const r = card.slice(0, -1);
    suits.add(s);
    ranks.add(r);
  }
  const uniqueCount = Math.min(suits.size, ranks.size);
  const drawCount = Math.max(0, 4 - uniqueCount);
  return Math.min(drawCount, 3);
}

/** 捨てるカードのインデックス（Badugi的に弱い順） */
function pickDiscardIndexes(hand, drawCount) {
  // ♠ > ♥ > ♦ > ♣ の順でランク重複・スーツ重複を優先除去
  const rankCount = {};
  const suitCount = {};
  hand.forEach((c) => {
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    rankCount[r] = (rankCount[r] || 0) + 1;
    suitCount[s] = (suitCount[s] || 0) + 1;
  });

  const rankOrder = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const scored = hand.map((c, i) => {
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    // ペアやスーツ重複を優先的に落とす
    let score = 0;
    if (rankCount[r] > 1) score += 2;
    if (suitCount[s] > 1) score += 1;
    // 数字の高さで加点（Aが最良、Kが最悪）
    score += rankOrder.indexOf(r) / 13;
    return { i, score };
  });

  // スコア高い順に捨てる
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, drawCount).map(x => x.i);
}
