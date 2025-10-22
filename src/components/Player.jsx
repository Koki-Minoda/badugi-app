// src/components/Player.jsx
import React from "react";
import Card from "./Card";
import { getPositionStyle } from "../utils/position";

export default function Player({
  player,
  index,
  selfIndex = 0,
  turn,
  dealerIdx,
  onCardClick,
  phase,
}) {
  const pos = getPositionStyle(index, selfIndex, 6);

  return (
    <div
      style={{
        ...pos,
        position: "absolute",
        transform: pos?.transform ?? "none", // 再描画時のブレ防止
        transition: "none", // ← translateY等のアニメーションを無効化
      }}
      className={`player-stable flex flex-col items-center gap-2 ${
        player.folded ? "opacity-50" : ""
      }`}

    >
      {/* 名前・ディーラーマーク */}
      <div
        className={`font-bold ${
          turn === index ? "text-red-500" : "text-white"
        }`}
      >
        {player.name} {index === dealerIdx ? "⬤(BTN)" : ""}{" "}
        {player.folded ? "(Folded)" : ""}
      </div>

      {/* アクションログ */}
      {player.lastAction && !player.folded && (
        <div className="text-sm text-yellow-400 italic">
          [{player.lastAction}]
        </div>
      )}

      {/* カード表示 */}
      <div className="player-cards flex gap-2">
        {player.hand.map((card, i) => (
          <Card
            key={`${card}-${i}`}
            value={card}
            hidden={index !== selfIndex && !player.showHand}
            selected={index === selfIndex && (player.selected || []).includes(i)}
            onClick={() => {
              if (
                index === selfIndex &&
                phase === "DRAW" &&
                turn === 0 &&
                onCardClick
              ) {
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
