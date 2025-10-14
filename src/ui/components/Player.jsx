// src/ui/components/Player.jsx
import React from "react";
import Card from "./Card";
import { getPositionStyle } from "../../utils/position";

export default function Player({ player, index, selfIndex = 0, turn, dealerIdx, onCardClick, phase }) {
  const pos = getPositionStyle(index, selfIndex, 6);

  return (
    <div style={pos} className={`absolute flex flex-col items-center gap-2 ${player.folded ? "opacity-50" : ""}`}>
      <div className={`font-bold ${turn === index ? "text-red-500" : "text-white"}`}>
        {player.name} {index === dealerIdx ? "⬤(BTN)" : ""} {player.folded ? "(Folded)" : ""}
      </div>

      {/* 直近のアクションを表示（Folded は除外） */}
      {player.lastAction && !player.folded && (
        <div className="text-sm text-yellow-400 italic">[{player.lastAction}]</div>
      )}

      <div className="flex gap-2">
        {player.hand.map((card, i) => (
<Card
  key={`${card}-${i}`}   // ← 値とインデックスを組み合わせてユニーク化
  value={card}
  hidden={index !== selfIndex && !player.showHand}
  selected={index === selfIndex && (player.selected || []).includes(i)}
  onClick={() => {
    if (index === selfIndex && phase === "DRAW" && turn === 0 && onCardClick) {
      onCardClick(i);
    }
  }}
  folded={player.folded}
/>

       ))}
      </div>

      <div className="text-yellow-200">Stack: {player.stack}</div>
    </div>
  );
}
