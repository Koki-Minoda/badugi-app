// src/gameLogic/drawRound.js
// プレイヤー (turn===0) は UI の drawSelected() で交換済み。
// NPC だけここで自動交換する。ドロー完了後は advanceAfterAction に制御を戻す。

export function runDrawRound({
  players,
  turn,
  deck,
  setPlayers,
  setDeck,
  advanceAfterAction,
}) {
  const p = players[turn];
  if (!p || p.folded) {
    // フォールド済みならスキップして次へ
    advanceAfterAction();
    return;
  }

  // 自分 (index 0) は UI で処理するのでここでは何もしない
  if (turn === 0) {
    return;
  }

  const newPlayers = [...players];
  const newDeck = [...deck];
  const npc = { ...newPlayers[turn] };

  if (!npc.hasDrawn) {
    // 交換枚数: 0〜2 枚
    const numChange = Math.floor(Math.random() * 3);
    let drawCount = 0;
    const newHand = [...npc.hand];

    for (let k = 0; k < numChange; k++) {
      const idx = Math.floor(Math.random() * 4);
      if (newDeck.length > 0) {
        newHand[idx] = newDeck.pop();
        drawCount++;
      }
    }

    npc.hand = newHand;
    npc.hasDrawn = true;
    npc.lastDrawCount = drawCount; // ← ログ表示や確認用
    newPlayers[turn] = npc;

    setPlayers(newPlayers);
    setDeck(newDeck);
  }

  // 少し遅延して次の処理へ
  setTimeout(() => advanceAfterAction(), 120);
}
