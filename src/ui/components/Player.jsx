import React from "react";
import Card from "./Card";
import { formatStatAf, formatStatPercent } from "../utils/stats.js";

function BetStatus({ amount, allIn = false }) {
  const hasBet = Number(amount) > 0;
  const chipLabel = allIn && hasBet ? "ALL-IN" : hasBet ? "BET" : "BET";
  return (
    <div
      data-testid="player-bet-status"
      className={`mt-1 inline-flex min-w-[64px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 font-black uppercase tracking-wide ${
        hasBet
          ? "border-amber-200/90 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_3px_0_rgba(120,53,15,0.75)]"
          : "border-white/10 bg-black/25 text-slate-400"
      }`}
      style={{ fontSize: "var(--player-stack-size, 11px)" }}
    >
      <span>{chipLabel}</span>
      <span data-testid="player-bet-amount">{amount}</span>
    </div>
  );
}

function StatusPill({ label, tone = "slate" }) {
  const toneClasses = {
    yellow: "border-yellow-200/70 bg-yellow-300/95 text-slate-950",
    purple: "border-purple-200/60 bg-purple-600/90 text-white",
    folded: "border-slate-500/60 bg-slate-800/90 text-slate-200",
    green: "border-emerald-200/60 bg-emerald-500/20 text-emerald-100",
    slate: "border-white/10 bg-black/40 text-slate-200",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        toneClasses[tone] ?? toneClasses.slate
      }`}
    >
      {label}
    </span>
  );
}

function AvatarChip({ avatar, name, isHero = false, isFolded = false, testId }) {
  const trimmedName = String(name ?? "").trim();
  const initials =
    trimmedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";
  const shouldRenderAvatarText =
    avatar &&
    avatar !== "default_avatar" &&
    !String(avatar).includes("_avatar");
  return (
    <span
      data-testid={testId}
      className={`grid shrink-0 place-items-center rounded-full border font-black shadow-inner ${
        isFolded
          ? "border-slate-500/40 bg-slate-800 text-slate-400"
          : isHero
            ? "border-emerald-200/70 bg-gradient-to-b from-emerald-300 to-emerald-700 text-slate-950"
            : "border-cyan-100/50 bg-gradient-to-b from-slate-200 to-slate-600 text-slate-950"
      }`}
      style={{
        width: "var(--player-avatar-size, 34px)",
        height: "var(--player-avatar-size, 34px)",
        fontSize: "var(--player-avatar-font-size, 13px)",
      }}
      aria-hidden="true"
    >
      {shouldRenderAvatarText ? avatar : initials}
    </span>
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
  const isFolded = Boolean(player.folded);
  const statusBadges = [];
  if (player.allIn) statusBadges.push("ALL-IN");
  if (isFolded) statusBadges.push("FOLDED");
  if (player.isBusted || player.seatOut) statusBadges.push("BUSTED");
  const stackValue = typeof player.stack === "number" ? player.stack : 0;
  const betValue = typeof player.betThisRound === "number" ? player.betThisRound : 0;
  const handCards = Array.isArray(player.hand) ? player.hand : [];
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
    player.cpuStyle ? `CPU style: ${player.cpuStyle}` : null,
    player.cpuModelId ? `Model: ${player.cpuModelId}` : null,
    player.trainingRun ? `Training: ${player.trainingRun}` : null,
    statsLine,
  ].filter(Boolean);
  const playerDetailTitle = playerDetailLines.join("\n");
  const detailPositionClass = isHero || seatIndex === 2 || seatIndex === 3 || seatIndex === 4
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
      className={`group relative overflow-visible rounded-[18px] border shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur flex flex-col outline-none transition hover:z-[80] focus:z-[80] focus-within:z-[80] focus-visible:ring-2 focus-visible:ring-sky-300 ${
        isFolded
          ? "border-slate-500/25 bg-slate-950/50 grayscale"
          : isHero
            ? "border-emerald-200/55 bg-slate-950/94"
            : "border-cyan-200/24 bg-slate-950/90"
      } ${isActive ? "ring-2 ring-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.55)]" : ""} ${
        isWinner ? "ring-4 ring-emerald-400 animate-pulse" : ""
      }`}
      style={{
        padding: "var(--player-pad, 10px)",
        gap: "var(--player-gap, 8px)",
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-[18px] ${
          isFolded
            ? "bg-slate-950/35"
            : isHero
              ? "bg-gradient-to-b from-emerald-300/10 via-transparent to-black/20"
              : "bg-gradient-to-b from-cyan-300/6 via-transparent to-black/25"
        }`}
      />
      <div
        data-testid={`seat-${seatIndex}-detail`}
        className={`pointer-events-none absolute left-1/2 z-[220] hidden w-[min(260px,80vw)] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-2xl group-hover:block group-focus:block ${detailPositionClass}`}
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
        {(player.cpuStyle || player.cpuModelId || player.trainingRun) && (
          <div className="mt-2 border-t border-white/10 pt-2 text-slate-300">
            {player.cpuStyle && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Style</span>
                <span className="truncate text-right text-white">{player.cpuStyle}</span>
              </div>
            )}
            {player.cpuModelId && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Model</span>
                <span className="truncate text-right text-white">{player.cpuModelId}</span>
              </div>
            )}
            {player.trainingRun && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Run</span>
                <span className="truncate text-right text-white">{player.trainingRun}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2 text-white font-semibold">
          <AvatarChip
            avatar={player.avatar}
            name={player.name}
            isHero={isHero}
            isFolded={isFolded}
            testId={`seat-${seatIndex}-avatar`}
          />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              {positionLabel && (
                <span data-testid={`seat-${seatIndex}-pos`}>
                  <StatusPill label={positionLabel} tone="slate" />
                </span>
              )}
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
                <StatusPill label="D" tone="yellow" />
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
              <div className="mt-1 flex flex-wrap gap-1">
                {statusBadges.map((badge) => (
                  <StatusPill
                    key={badge}
                    label={badge}
                    tone={badge === "ALL-IN" ? "purple" : badge === "FOLDED" ? "folded" : "slate"}
                  />
                ))}
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
          <div className="rounded-full border border-white/10 bg-black/45 px-2 py-1 font-semibold">
            <span className="text-slate-400">Stack</span>{" "}
            <span className="text-white">{stackValue}</span>
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
        className="relative z-10 flex items-center text-slate-200 italic"
        style={{
          fontSize: "var(--player-stack-size, 11px)",
          minHeight: "var(--player-action-min-h, 18px)",
        }}
      >
        {player.lastAction ? `[${player.lastAction}]` : "\u00A0"}
      </div>

      {isFolded ? (
        <div
          data-testid={`player-${index}-mucked`}
          className="relative z-10 flex min-h-[calc(var(--card-h,56px)*0.72)] w-full items-center justify-center rounded-xl border border-slate-500/25 bg-slate-950/65 px-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400"
        >
          Folded - mucked
        </div>
      ) : (
        <div
          className="relative z-10 grid w-full mx-auto justify-items-center"
          style={{
            gap: "var(--player-card-gap, 8px)",
            maxWidth: "var(--player-card-strip-maxw, 280px)",
            gridTemplateColumns: `repeat(${Math.max(1, handCards.length || 4)}, minmax(0, 1fr))`,
          }}
        >
          {handCards.map((card, i) => (
            <Card
              key={`${card}-${i}`}
              value={card}
              hidden={!isHero && !player.showHand}
              selected={isHero && (player.selected || []).includes(i)}
              onClick={() => handleCardClick(i)}
              folded={isFolded}
              data-testid={`player-${index}-card-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
