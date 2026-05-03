import React from "react";
import Card from "./Card";
import { formatStatAf, formatStatPercent } from "../utils/stats.js";

function BetStatus({ amount, allIn = false }) {
  const hasBet = Number(amount) > 0;
  const label = allIn && hasBet ? "All-in" : "Bet";
  return (
    <div
      data-testid="player-bet-status"
      className={`mt-1 flex items-center justify-end gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-wide ${
        hasBet
          ? "border-amber-300/80 bg-amber-400 text-slate-950 shadow-sm"
          : "border-white/10 bg-black/25 text-slate-400"
      }`}
      style={{ fontSize: "var(--player-stack-size, 11px)" }}
    >
      <span>{label}</span>
      <span data-testid="player-bet-amount">{amount}</span>
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
  const playerDetailLines = [
    `${player.name}${positionLabel ? ` (${positionLabel})` : ""}`,
    `Stack: ${stackValue}`,
    `${player.allIn && betValue > 0 ? "All-in" : "Bet"}: ${betValue}`,
    `Status: ${statusBadges.length > 0 ? statusBadges.join(", ") : "Ready"}`,
    `Last action: ${player.lastAction || "-"}`,
    statsLine,
  ];
  const playerDetailTitle = playerDetailLines.join("\n");
  const detailPositionClass = isHero
    ? "bottom-full mb-2"
    : "top-full mt-2";

  const handleCardClick = (cardIdx) => {
    if (isHero && phase === "DRAW" && canSelectForDraw && onCardClick) {
      onCardClick(cardIdx);
    }
  };

  return (
    <div
      data-testid={`seat-${seatIndex}`}
      tabIndex={0}
      title={playerDetailTitle}
      className={`group relative rounded-2xl border border-white/10 bg-gray-900/85 shadow-lg backdrop-blur flex flex-col outline-none transition focus-visible:ring-2 focus-visible:ring-sky-300 ${
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
      <div
        data-testid={`seat-${seatIndex}-detail`}
        className={`pointer-events-none absolute left-1/2 z-30 hidden w-[min(260px,80vw)] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-2xl group-hover:block group-focus:block ${detailPositionClass}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-white">{player.name}</strong>
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
            {positionLabel ?? `Seat ${seatIndex + 1}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span className="text-slate-400">Stack</span>
          <span className="text-right font-semibold text-white">{stackValue}</span>
          <span className="text-slate-400">{player.allIn && betValue > 0 ? "All-in" : "Bet"}</span>
          <span className="text-right font-semibold text-white">{betValue}</span>
          <span className="text-slate-400">Last</span>
          <span className="truncate text-right text-white">{player.lastAction || "-"}</span>
        </div>
        <div className="mt-2 border-t border-white/10 pt-2 text-slate-300">{statsLine}</div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2 text-white font-semibold">
          {player.avatar && (
            <span
              className="shrink-0 leading-none"
              style={{ fontSize: "calc(var(--player-name-size, 14px) + 2px)" }}
            >
              {player.avatar}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className="truncate"
                style={{
                  fontSize: "var(--player-name-size, 14px)",
                  maxWidth: "var(--player-name-maxw, 150px)",
                }}
              >
                {player.name}
              </span>
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
          className="shrink-0 text-right text-slate-200 leading-tight"
          style={{ fontSize: "var(--player-stack-size, 11px)" }}
        >
          <div className="rounded bg-black/25 px-1.5 py-0.5">
            Stack <span className="font-semibold text-white">{stackValue}</span>
          </div>
          <BetStatus amount={betValue} allIn={player.allIn} />
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
    </div>
  );
}
