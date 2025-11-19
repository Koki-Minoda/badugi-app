import React from "react";
import Card from "./Card";

function BetChip({ amount, className = "" }) {
  if (!amount || amount <= 0) return null;
  const tier =
    amount >= 500
      ? "from-red-500 to-red-700 border-red-200"
      : amount >= 100
      ? "from-blue-500 to-blue-700 border-blue-200"
      : amount >= 25
      ? "from-green-500 to-green-700 border-green-200"
      : "from-yellow-400 to-yellow-500 border-yellow-100 text-gray-900";
  return (
    <div
      className={`flex items-center gap-2 bg-black/70 px-3 py-1 rounded-xl border border-white/20 shadow-lg ${className}`}
    >
      <div
        className={`w-8 h-8 rounded-full border-2 ${tier} text-xs font-bold flex items-center justify-center`}
      >
        {amount >= 1000 ? `${Math.floor(amount / 1000)}K` : amount}
      </div>
      <span className="text-sm font-semibold text-white">{amount}</span>
    </div>
  );
}

export default function Player({
  player,
  index,
  selfIndex = 0,
  turn,
  dealerIdx,
  onCardClick,
  phase,
  isWinner = false,
}) {
  const isHero = index === selfIndex;
  const isActive = turn === index;
  const statusBadges = [];
  if (player.allIn) statusBadges.push("ALL-IN");
  if (player.folded) statusBadges.push("FOLDED");
  if (player.isBusted || player.seatOut) statusBadges.push("BUSTED");
  const stackValue = typeof player.stack === "number" ? player.stack : 0;
  const betValue = typeof player.betThisRound === "number" ? player.betThisRound : 0;

  const handleCardClick = (cardIdx) => {
    if (isHero && phase === "DRAW" && turn === 0 && onCardClick) {
      onCardClick(cardIdx);
    }
  };

  const chipBelow = index >= 2 && index <= 4;

  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-gray-900/80 p-3 shadow-lg backdrop-blur flex flex-col gap-2 ${
        player.folded ? "opacity-60" : ""
      } ${isActive ? "ring-2 ring-yellow-400" : ""} ${isWinner ? "ring-4 ring-emerald-400 animate-pulse" : ""}`}
    >
      {betValue > 0 && !chipBelow && (
        <BetChip amount={betValue} className="absolute -top-14 left-1/2 -translate-x-1/2" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          {player.avatar && <span className="text-xl leading-none">{player.avatar}</span>}
          <div className="leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span>{player.name}</span>
              {index === dealerIdx && (
                <span className="text-[10px] text-yellow-300 uppercase tracking-wide">(BTN)</span>
              )}
            </div>
            {player.titleBadge && (
              <div className="text-[10px] uppercase tracking-wide text-emerald-300">
                {player.titleBadge}
              </div>
            )}
            {statusBadges.length > 0 && (
              <div className="text-[10px] uppercase tracking-wide text-yellow-300">
                {statusBadges.join(" • ")}
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-slate-200 leading-tight">
          <div>
            Stack <span className="font-semibold text-white">{stackValue}</span>
          </div>
          <div>
            Bet <span className="font-semibold text-white">{betValue}</span>
          </div>
          {isActive && <div className="text-lime-300 font-bold mt-1">ACTING</div>}
        </div>
      </div>

      <div className="text-xs text-slate-200 italic min-h-[18px] flex items-center">
        {player.lastAction ? `[${player.lastAction}]` : "\u00A0"}
      </div>

      <div className="grid grid-cols-4 gap-2 justify-items-center w-full max-w-[260px] mx-auto">
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
      {betValue > 0 && chipBelow && (
        <BetChip amount={betValue} className="absolute left-1/2 -translate-x-1/2 top-full mt-2" />
      )}
    </div>
  );
}
