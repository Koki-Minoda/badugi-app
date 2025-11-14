import React from "react";
import Card from "./Card";

export default function Player({
  player,
  index,
  selfIndex = 0,
  turn,
  dealerIdx,
  onCardClick,
  phase,
}) {
  const isHero = index === selfIndex;
  const isActive = turn === index;
  const statusBadges = [];
  if (player.allIn) statusBadges.push("ALL-IN");
  if (player.folded) statusBadges.push("FOLDED");
  if (player.isBusted || player.seatOut) statusBadges.push("BUSTED");

  const handleCardClick = (cardIdx) => {
    if (isHero && phase === "DRAW" && turn === 0 && onCardClick) {
      onCardClick(cardIdx);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gray-900/70 p-4 shadow-lg backdrop-blur flex flex-col gap-3 ${
        player.folded ? "opacity-60" : ""
      } ${isActive ? "ring-2 ring-yellow-400" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white flex items-center gap-2">
          <span>{player.name}</span>
          {index === dealerIdx && (
            <span className="text-xs text-yellow-300 uppercase tracking-wide">(BTN)</span>
          )}
        </div>
        {isActive && <span className="text-xs text-lime-300 font-bold">ACTING</span>}
      </div>

      {statusBadges.length > 0 && (
        <div className="text-xs uppercase tracking-wide text-yellow-300">
          {statusBadges.join(" · ")}
        </div>
      )}

      {player.lastAction && (
        <div className="text-sm text-slate-200 italic">[{player.lastAction}]</div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
        <div>
          Stack: <span className="font-semibold text-white">{player.stack}</span>
        </div>
        <div>
          Current Bet:{" "}
          <span className="font-semibold text-white">{player.betThisRound ?? 0}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {player.hand.map((card, i) => (
          <Card
            key={`${card}-${i}`}
            value={card}
            hidden={!isHero && !player.showHand}
            selected={isHero && (player.selected || []).includes(i)}
            onClick={() => handleCardClick(i)}
            folded={player.folded}
          />
        ))}
      </div>
    </div>
  );
}
