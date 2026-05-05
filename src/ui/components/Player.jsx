import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Card from "./Card";
import { formatStatAf, formatStatPercent } from "../utils/stats.js";
import { getDisplayCards } from "../utils/cardDisplayOrder.js";

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

function AvatarImage({ src, initials }) {
  const [failed, setFailed] = useState(false);
  if (failed) return initials;
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full rounded-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
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
    !String(avatar).includes("_avatar") &&
    !String(avatar).startsWith("/");
  const shouldRenderAvatarImage = avatar && String(avatar).startsWith("/");
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
      {shouldRenderAvatarImage ? (
        <AvatarImage src={avatar} initials={initials} />
      ) : shouldRenderAvatarText ? avatar : initials}
    </span>
  );
}

function formatHudPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function HudMetricRing({ label, value }) {
  const numeric = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const degrees = Math.round(numeric * 360);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-100">{label}</span>
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#f59e0b ${degrees}deg, rgba(255,255,255,0.12) 0deg)`,
        }}
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-[12px] font-black text-white">
          {formatHudPercent(value)}
        </div>
      </div>
    </div>
  );
}

function HudBar({ label, value, trailing = null }) {
  const numeric = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
  return (
    <div className="grid grid-cols-[38px_1fr_42px] items-center gap-2 text-[11px]">
      <span className="font-black uppercase text-slate-200">{label}</span>
      <div className="h-5 overflow-hidden rounded-sm bg-white/12">
        <div
          className="h-full bg-slate-400/80"
          style={{ width: numeric === null ? "0%" : `${Math.round(numeric * 100)}%` }}
        />
      </div>
      <span className="text-right font-black text-white">
        {trailing ?? formatHudPercent(value)}
      </span>
    </div>
  );
}

function PlayerSmartHud({ player, positionLabel, stats, statsLine, stackValue, betValue, statusBadges }) {
  const [scope, setScope] = useState("all");
  const street = stats?.street ?? {};
  const hands = Number.isFinite(stats?.hands) ? stats.hands : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AvatarChip
            avatar={player.avatar}
            name={player.name}
            isHero={false}
            isFolded={Boolean(player.folded)}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{player.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              {positionLabel ?? "Seat"} · Hands {hands}
            </p>
          </div>
        </div>
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="pointer-events-auto rounded bg-emerald-600 px-2 py-1 text-[11px] font-black text-white outline-none"
          aria-label="HUD game scope"
        >
          <option value="all">All Games</option>
          <option value="nlh">NLH</option>
          <option value="plo">PLO</option>
          <option value="badugi">Badugi</option>
          <option value="deuce">2-7</option>
          <option value="stud">Stud</option>
          <option value="razz">Razz</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <HudMetricRing label="VPIP" value={stats?.vpipRate} />
        <HudMetricRing label="PFR" value={stats?.pfrRate} />
        <HudMetricRing label="ATS" value={stats?.atsRate} />
        <HudMetricRing label="3BET" value={stats?.threeBetRate} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-center text-[11px] font-black uppercase text-slate-200">Flop</p>
          <HudBar label="CB" value={street.flop?.cb} />
          <HudBar label="FCB" value={street.flop?.fcb} />
          <HudBar label="CCB" value={street.flop?.ccb} />
          <HudBar label="RCB" value={street.flop?.rcb} />
        </div>
        <div>
          <p className="mb-1 text-center text-[11px] font-black uppercase text-slate-200">Turn</p>
          <HudBar label="CB" value={street.turn?.cb} />
          <HudBar label="FCB" value={street.turn?.fcb} />
          <HudBar label="CCB" value={street.turn?.ccb} />
          <HudBar label="RCB" value={street.turn?.rcb} />
        </div>
        <div>
          <p className="mb-1 text-center text-[11px] font-black uppercase text-slate-200">River</p>
          <HudBar label="WT" value={street.river?.wt} />
          <HudBar label="WSD" value={street.river?.wsd} />
          <HudBar label="TAF" value={street.river?.taf} />
          <HudBar label="Hands" value={null} trailing={hands} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-2 text-[11px]">
        <div>
          <p className="text-slate-500">Stack</p>
          <p className="font-black text-white">{stackValue}</p>
        </div>
        <div>
          <p className="text-slate-500">Bet</p>
          <p className="font-black text-white">{betValue}</p>
        </div>
        <div>
          <p className="text-slate-500">Status</p>
          <p className="truncate font-black text-white">
            {statusBadges.length > 0 ? statusBadges.join(", ") : "Ready"}
          </p>
        </div>
      </div>
      <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">{statsLine}</p>
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
  compact = false,
  revealMode = false,
  displayVariant = "badugi",
}) {
  const seatRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [hudOpen, setHudOpen] = useState(false);
  const [hudStyle, setHudStyle] = useState(null);
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );
  const seatIndex = typeof index === "number" ? index : 0;
  const isHero = index === selfIndex;
  const isActive = turn === index;
  const isFolded = Boolean(player.folded);
  const shouldRevealLarge =
    revealMode && !compact && !isFolded && (isHero || player.showHand || isWinner);
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
      : "VPIP -- / PFR -- / ATS -- / 3BET -- / H --";
  const compactStatsLine =
    stats && Number.isFinite(stats.hands) && stats.hands > 0
      ? `VPIP ${formatStatPercent(stats.vpipRate)}%  PFR ${formatStatPercent(stats.pfrRate)}%  3B ${formatHudPercent(
          stats.threeBetRate,
        )}  H ${stats.hands}`
      : "HUD --";
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

  const openHud = useCallback(() => {
    if (isHero && phase === "DRAW") {
      setHudOpen(false);
      return;
    }
    const isCoarseTouch =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse) and (hover: none)").matches;
    if (isCoarseTouch) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const rect = seatRef.current?.getBoundingClientRect?.();
    if (!rect || typeof window === "undefined") {
      setHudOpen(true);
      return;
    }
    const width = Math.min(620, Math.max(320, window.innerWidth - 24));
    const estimatedHeight = 318;
    const margin = 12;
    const preferredBelow = rect.bottom + margin;
    const preferredAbove = rect.top - estimatedHeight - margin;
    const hasRoomBelow = preferredBelow + estimatedHeight <= window.innerHeight - margin;
    const rawTop = hasRoomBelow ? preferredBelow : preferredAbove;
    const left = Math.min(
      window.innerWidth - width - margin,
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
    );
    const top = Math.min(
      window.innerHeight - estimatedHeight - margin,
      Math.max(margin, rawTop),
    );
    setHudStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
    });
    setHudOpen(true);
  }, [isHero, phase]);

  const scheduleCloseHud = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setHudOpen(false);
      closeTimerRef.current = null;
    }, 120);
  }, []);

  const keepHudOpen = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleCardClick = (cardIdx) => {
    if (isHero && phase === "DRAW" && canSelectForDraw && onCardClick) {
      onCardClick(cardIdx);
    }
  };
  const displayCards = getDisplayCards(handCards, { displayVariant });
  const hasStudVisibility = Array.isArray(player.cardVisibility) && player.cardVisibility.length > 0;

  const hudOverlay =
    hudOpen && !compact && typeof document !== "undefined"
      ? createPortal(
          <div
            data-testid={`seat-${seatIndex}-detail`}
            onMouseEnter={keepHudOpen}
            onMouseLeave={scheduleCloseHud}
            className="z-[260] rounded-xl border border-white/15 bg-black/95 p-4 text-[11px] text-slate-200 shadow-2xl"
            style={hudStyle ?? undefined}
          >
            <PlayerSmartHud
              player={player}
              positionLabel={positionLabel}
              stats={stats}
              statsLine={statsLine}
              stackValue={stackValue}
              betValue={betValue}
              statusBadges={statusBadges}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
    <div
      ref={seatRef}
      data-testid={`seat-${seatIndex}`}
      tabIndex={0}
      aria-label={playerDetailTitle}
      onMouseEnter={openHud}
      onMouseLeave={scheduleCloseHud}
      onFocus={openHud}
      onBlur={scheduleCloseHud}
      className={`relative overflow-visible rounded-[18px] border shadow-[0_10px_20px_rgba(0,0,0,0.35)] backdrop-blur flex flex-col outline-none transition hover:z-[80] focus:z-[80] focus-within:z-[80] focus-visible:ring-2 focus-visible:ring-sky-300 ${
        isFolded
          ? "border-slate-500/25 bg-slate-950/50 grayscale"
          : isHero
            ? "border-emerald-200/55 bg-slate-950/94"
            : "border-cyan-200/24 bg-slate-950/90"
      } ${isActive ? "ring-2 ring-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.55)]" : ""} ${
        isWinner ? "ring-4 ring-emerald-400 animate-pulse" : ""
      } ${
        shouldRevealLarge ? "z-[90] scale-[1.06]" : ""
      }`}
      style={{
        padding: "var(--player-pad, 10px)",
        gap: "var(--player-gap, 8px)",
        ...(compact && !isHero
          ? {
              "--card-w": "clamp(30px, 4.4dvw, 42px)",
              "--card-h": "clamp(42px, 6.2dvw, 59px)",
              "--card-font-size": "clamp(10px, 1.4dvw, 13px)",
            }
          : compact && isHero
          ? {
              "--card-w": "clamp(38px, 5.6dvw, 54px)",
              "--card-h": "clamp(53px, 7.8dvw, 76px)",
              "--card-font-size": "clamp(12px, 1.8dvw, 16px)",
            }
          : shouldRevealLarge
          ? {
              "--card-w": "calc(var(--card-w, 56px) * 1.12)",
              "--card-h": "calc(var(--card-h, 78px) * 1.12)",
              "--card-font-size": "calc(var(--card-font-size, 22px) * 1.06)",
              "--player-card-strip-maxw": "calc(var(--player-card-strip-maxw, 280px) * 1.12)",
            }
          : {}),
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
            {player.titleBadge && !compact && (
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
            {!compact && (
              <div
              className="uppercase tracking-wide text-slate-300 truncate"
              style={{
                fontSize: "var(--player-meta-size, 10px)",
                maxWidth: "var(--player-card-strip-maxw, 240px)",
              }}
              title={statsLine}
            >
              {compactStatsLine}
              </div>
            )}
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
          {isActive && !compact && (
            <div
              className="text-lime-300 font-bold mt-1"
              style={{ fontSize: "var(--player-action-size, 11px)" }}
            >
              ACTING
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <div
          className="relative z-10 flex items-center text-slate-200 italic"
          style={{
            fontSize: "var(--player-stack-size, 11px)",
            minHeight: "var(--player-action-min-h, 18px)",
          }}
        >
          {player.lastAction ? `[${player.lastAction}]` : "\u00A0"}
        </div>
      )}

      {isFolded ? (
        <div
          data-testid={`player-${index}-mucked`}
          className={`relative z-10 flex w-full items-center justify-center rounded-xl border border-slate-500/25 bg-slate-950/65 px-3 font-black uppercase text-slate-400 ${
            compact
              ? "min-h-[calc(var(--card-h,56px)*0.52)] text-[8px] tracking-[0.14em]"
              : "min-h-[calc(var(--card-h,56px)*0.72)] text-[11px] tracking-[0.22em]"
          }`}
        >
          Folded - mucked
        </div>
      ) : (
        <div
          className="relative z-10 grid w-full mx-auto justify-items-center"
          style={{
            gap: "var(--player-card-gap, 8px)",
            maxWidth: "var(--player-card-strip-maxw, 280px)",
            gridTemplateColumns: `repeat(${Math.max(1, displayCards.length || 4)}, minmax(0, 1fr))`,
          }}
        >
          {displayCards.map(({ card, sourceIndex }) => {
            const visibility = player.cardVisibility?.[sourceIndex] ?? "up";
            const isPublicCard = visibility === "up";
            const isHiddenFromHero = !isHero && !player.showHand && !isPublicCard;
            const isStudDownCard = hasStudVisibility && !isPublicCard;
            const visibilityLabel = isPublicCard
              ? "UP"
              : isHero
                ? "DOWN"
                : "HIDDEN";
            return (
              <div
                key={`${card}-${sourceIndex}`}
                className={`flex min-w-0 flex-col items-center gap-0.5 ${
                  hasStudVisibility
                    ? isPublicCard
                      ? "-translate-y-2"
                      : "translate-y-1"
                    : ""
                }`}
                data-testid={
                  hasStudVisibility
                    ? `player-${index}-card-${sourceIndex}-${isPublicCard ? "up" : "down"}-slot`
                    : undefined
                }
              >
                <div
                  className={`rounded-xl ${
                    hasStudVisibility
                      ? isPublicCard
                        ? "ring-2 ring-emerald-300/70 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                        : "ring-1 ring-slate-500/70 shadow-[0_0_10px_rgba(15,23,42,0.45)]"
                      : ""
                  }`}
                >
                  <Card
                    value={card}
                    hidden={isHiddenFromHero}
                    selected={isHero && (player.selected || []).includes(sourceIndex)}
                    onClick={() => handleCardClick(sourceIndex)}
                    folded={isFolded}
                    studDown={isStudDownCard && !isHiddenFromHero}
                    data-testid={`player-${index}-card-${sourceIndex}`}
                  />
                </div>
                {hasStudVisibility && (
                  <span
                    data-testid={`player-${index}-card-${sourceIndex}-visibility`}
                    className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase leading-none ${
                      isPublicCard
                        ? "bg-emerald-400/20 text-emerald-100"
                        : "bg-slate-700/70 text-slate-200"
                    }`}
                  >
                    {visibilityLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    {hudOverlay}
    </>
  );
}
