import React from "react";

const PLACEHOLDER_TIME = "--:--";

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toLocaleString();
}

function formatOrdinal(place) {
  if (typeof place !== "number") {
    return place != null ? `${place}` : "--";
  }
  const remainder = place % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${place}th`;
  }
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

function formatPayoutRows(rows = []) {
  if (!rows.length) {
    return [
      { place: 1, percent: null, amount: null },
      { place: 2, percent: null, amount: null },
      { place: 3, percent: null, amount: null },
    ];
  }
  return rows.slice(0, 3);
}

export default function TournamentHUD({
  tournamentName = "Store Tournament",
  prizePoolTotal = null,
  payoutBreakdown = [],
  playersRemaining = 0,
  totalEntrants = 0,
  totalPlayers,
  averageStack = null,
  currentLevelNumber = null,
  levelLabel = null,
  currentBlinds = {},
  nextLevelBlinds = null,
  handsPlayedThisLevel = 0,
  handsThisLevel = null,
  nextBreakLabel = null,
  currentVariantLabel = null,
  nextVariantLabel = null,
  compact = false,
}) {
  const displayPayouts = formatPayoutRows(payoutBreakdown);
  const prizePoolDisplay =
    prizePoolTotal != null ? formatNumber(prizePoolTotal) : "--";
  const avgStackDisplay =
    averageStack != null ? formatNumber(averageStack) : "--";
  const playersDisplay = `${playersRemaining ?? 0} / ${
    totalEntrants ?? totalPlayers ?? 0
  }`;
  const blindsDisplay =
    currentBlinds && (currentBlinds.sb != null || currentBlinds.bb != null)
      ? `${currentBlinds.sb ?? "--"} / ${currentBlinds.bb ?? "--"}`
      : "-- / --";
  const anteDisplay =
    currentBlinds && currentBlinds.ante != null
      ? `Ante ${currentBlinds.ante}`
      : "Ante --";
  const nextLevelDisplay = nextLevelBlinds
    ? `${nextLevelBlinds.sb ?? "--"} / ${nextLevelBlinds.bb ?? "--"}${
        nextLevelBlinds.ante != null ? ` (Ante ${nextLevelBlinds.ante})` : ""
      }`
    : "—";
  const progressDisplay = handsThisLevel
    ? `${Math.min(handsPlayedThisLevel ?? 0, handsThisLevel)} / ${handsThisLevel}`
    : `${handsPlayedThisLevel ?? 0}`;
  const breakDisplay = nextBreakLabel ?? PLACEHOLDER_TIME;
  const levelDisplay =
    levelLabel ??
    (currentLevelNumber != null ? `Level ${currentLevelNumber}` : "Level —");

  return (
    <div
      className={`mx-auto rounded-2xl border border-white/10 bg-slate-950/90 text-slate-50 shadow-xl ${
        compact ? "max-w-[1280px] px-3 py-2" : "max-w-[1400px] px-6 py-4"
      }`}
      data-testid="tournament-hud"
    >
      <div
        className={
          compact
            ? "grid grid-cols-[0.8fr_1.2fr_1fr] gap-3"
            : "grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr_1fr]"
        }
      >
        <div className={`flex flex-col justify-between border-slate-800 ${
          compact ? "border-r pr-3" : "border-b pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4"
        }`}>
          <div className="text-[11px] font-semibold tracking-[0.3em] text-yellow-300">
            PRIZE POOL
          </div>
          <div className={`${compact ? "mt-1 space-y-0.5" : "mt-3 space-y-2"} text-xs text-slate-200`}>
            {displayPayouts.map((entry) => (
              <div
                key={`payout-${entry.place}`}
                className="flex items-center justify-between"
              >
                <span>{formatOrdinal(entry.place)}</span>
                <span className="text-right">
                  {entry.amount != null ? formatNumber(entry.amount) : "--"}
                  {entry.percent != null ? (
                    <span className="ml-1 text-[10px] text-slate-500">
                      ({entry.percent}%)
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          <div className={`${compact ? "mt-1 text-lg" : "mt-4 text-2xl"} font-bold text-yellow-300`}>
            {prizePoolDisplay}
          </div>
        </div>

        <div className={`flex flex-col items-center justify-between border-slate-800 text-center ${
          compact ? "border-r px-3" : "border-b pb-4 md:border-b-0 md:border-r md:pb-0 md:px-4"
        }`}>
          <div className={`${compact ? "text-xs" : "text-sm"} font-semibold tracking-wide text-yellow-300 mb-1`}>
            {tournamentName}
          </div>
          <div className={`${compact ? "text-sm" : "text-lg"} font-semibold mb-1`}>{levelDisplay}</div>
          <div className={`${compact ? "text-3xl mb-1" : "text-5xl mb-3"} font-bold leading-none text-white`}>
            {progressDisplay}
          </div>
          <div className="w-full space-y-1 text-left text-xs">
            <div className="flex justify-between">
              <span className="font-semibold text-yellow-300">Blinds</span>
              <span>{blindsDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-yellow-300">Ante</span>
              <span>{anteDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-yellow-300">Next Level</span>
              <span>{nextLevelDisplay}</span>
            </div>
          </div>
        </div>

        <div className={`flex ${compact ? "gap-3" : "flex-col justify-between pl-0 text-xs md:pl-4"} text-xs`}>
          <div>
            <div className="font-semibold tracking-wide text-yellow-300">
              NEXT BREAK IN
            </div>
            <div className={`${compact ? "text-lg" : "text-2xl"} font-bold`}>{breakDisplay}</div>
          </div>
          <div className={compact ? "" : "mt-4"}>
            <div className="font-semibold tracking-wide text-yellow-300">
              AVG STACK
            </div>
            <div className={`${compact ? "text-lg" : "text-2xl"} font-bold`}>{avgStackDisplay}</div>
          </div>
          <div className={compact ? "" : "mt-4"}>
            <div className="font-semibold tracking-wide text-yellow-300">
              PLAYERS
            </div>
            <div className={`${compact ? "text-lg" : "text-2xl"} font-bold`}>{playersDisplay}</div>
          </div>
          {(currentVariantLabel || nextVariantLabel) && (
            <div className={`${compact ? "" : "mt-4"} text-left text-xs`}>
              <div className="font-semibold tracking-wide text-yellow-300">
                CURRENT GAME
              </div>
              <div className="text-sm font-semibold">
                {currentVariantLabel ?? "-"}
              </div>
              {nextVariantLabel ? (
                <div className="text-[11px] text-slate-400">
                  Next: {nextVariantLabel}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
