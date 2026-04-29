import React from "react";
import Card from "./Card";
import { formatStatAf, formatStatPercent } from "../utils/stats.js";

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
      className={`flex items-center gap-2 bg-black/70 rounded-xl border border-white/20 shadow-lg ${className}`}
      style={{
        paddingInline: "var(--player-chip-pad-x, 10px)",
        paddingBlock: "var(--player-chip-pad-y, 6px)",
      }}
    >
      <div
        className={`rounded-full border-2 ${tier} font-bold flex items-center justify-center`}
        style={{
          width: "var(--player-chip-bubble-size, 24px)",
          height: "var(--player-chip-bubble-size, 24px)",
          fontSize: "var(--player-chip-bubble-font-size, 10px)",
        }}
      >
        {amount >= 1000 ? `${Math.floor(amount / 1000)}K` : amount}
      </div>
      <span
        className="font-semibold text-white"
        style={{ fontSize: "var(--player-chip-amount-size, 12px)" }}
      >
        {amount}
      </span>
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
  positionLabel,
  canSelectForDraw = false,
}) {
  const seatIndex = typeof index === "number" ? index : 0;
  const isHero = index === selfIndex;
  const isActive = turn === index;
  const statusBadges = [];
  if (player.allIn) statusBadges.push("ALL-IN");
  if (player.folded) statusBadges.push("FOLDED");
  if (player.isBusted || player.seatOut) statusBadges.push("BUSTED");
  const stackValue = typeof player.stack === "number" ? player.stack : 0;
  const betValue = typeof player.betThisRound === "number" ? player.betThisRound : 0;
  const stats = player.stats;
  const statsLine =
    stats && Number.isFinite(stats.hands) && stats.hands > 0
      ? `VPIP ${formatStatPercent(stats.vpipRate)} / PFR ${formatStatPercent(
          stats.pfrRate
        )} / AF ${formatStatAf(stats.af)} / H ${stats.hands}`
      : "VPIP -- / PFR -- / AF -- / H --";

  const handleCardClick = (cardIdx) => {
    if (isHero && phase === "DRAW" && canSelectForDraw && onCardClick) {
      onCardClick(cardIdx);
    }
  };

  const chipBelow = index >= 2 && index <= 4;

  return (
    <div
      data-testid={`seat-${seatIndex}`}
      className={`relative rounded-2xl border border-white/10 bg-gray-900/80 shadow-lg backdrop-blur flex flex-col ${
        player.folded ? "opacity-60" : ""
      } ${isActive ? "ring-2 ring-yellow-400" : ""} ${isWinner ? "ring-4 ring-emerald-400 animate-pulse" : ""}`}
      style={{
        padding: "var(--player-pad, 10px)",
        gap: "var(--player-gap, 8px)",
      }}
    >
      {positionLabel && (
        <div
          data-testid={`seat-${seatIndex}-pos`}
          className="absolute top-2 left-2 rounded-md bg-black/40 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-slate-100/90"
          style={{ fontSize: "var(--player-meta-size, 10px)" }}
        >
          {positionLabel}
        </div>
      )}
      {betValue > 0 && !chipBelow && (
        <BetChip amount={betValue} className="absolute -top-14 left-1/2 -translate-x-1/2" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-white font-semibold">
          {player.avatar && (
            <span
              className="leading-none"
              style={{ fontSize: "calc(var(--player-name-size, 14px) + 2px)" }}
            >
              {player.avatar}
            </span>
          )}
          <div className="leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span style={{ fontSize: "var(--player-name-size, 14px)" }}>{player.name}</span>
              {index === dealerIdx && (
                <span
                  className="text-yellow-300 uppercase tracking-wide"
                  style={{ fontSize: "var(--player-meta-size, 10px)" }}
                >
                  (BTN)
                </span>
              )}
            </div>
            {player.titleBadge && (
              <div
                className="uppercase tracking-wide text-emerald-300"
                style={{ fontSize: "var(--player-meta-size, 10px)" }}
              >
                {player.titleBadge}
              </div>
            )}
            {statusBadges.length > 0 && (
              <div
                className="uppercase tracking-wide text-yellow-300"
                style={{ fontSize: "var(--player-meta-size, 10px)" }}
              >
                {statusBadges.join(" • ")}
              </div>
            )}
            <div
              className="uppercase tracking-wide text-slate-300 truncate"
              style={{
                fontSize: "var(--player-meta-size, 10px)",
                maxWidth: "var(--player-card-strip-maxw, 240px)",
              }}
              title={statsLine}
            >
              {statsLine}
            </div>
          </div>
        </div>
        <div
          className="text-right text-slate-200 leading-tight"
          style={{ fontSize: "var(--player-stack-size, 11px)" }}
        >
          <div>
            Stack <span className="font-semibold text-white">{stackValue}</span>
          </div>
          <div>
            Bet <span className="font-semibold text-white">{betValue}</span>
          </div>
          {isActive && (
            <div
              className="text-lime-300 font-bold mt-1"
              style={{ fontSize: "var(--player-action-size, 11px)" }}
            >
              ACTING
            </div>
          )}
        </div>
      </div>

      <div
        className="text-slate-200 italic flex items-center"
        style={{
          fontSize: "var(--player-stack-size, 11px)",
          minHeight: "var(--player-action-min-h, 18px)",
        }}
      >
        {player.lastAction ? `[${player.lastAction}]` : "\u00A0"}
      </div>

      <div
        className="grid justify-items-center w-full mx-auto"
        style={{
          gap: "var(--player-card-gap, 8px)",
          maxWidth: "var(--player-card-strip-maxw, 280px)",
          gridTemplateColumns: `repeat(${Math.max(1, player.hand?.length ?? 4)}, minmax(0, 1fr))`,
        }}
      >
        {player.hand.map((card, i) => (
          <Card
            key={`${card}-${i}`}
            value={card}
            hidden={!isHero && !player.showHand}
            selected={isHero && (player.selected || []).includes(i)}
            onClick={() => handleCardClick(i)}
            folded={player.folded}
            data-testid={`player-${index}-card-${i}`}
          />
        ))}
      </div>
      {betValue > 0 && chipBelow && (
        <BetChip amount={betValue} className="absolute left-1/2 -translate-x-1/2 top-full mt-2" />
      )}
    </div>
  );
}
