import React from "react";

function statusBadges(player, isHero, isActive) {
  const badges = [];
  if (isHero) badges.push("YOU");
  if (player.allIn) badges.push("ALL-IN");
  if (player.folded) badges.push("FOLDED");
  if (player.isBusted || player.seatOut) badges.push("BUSTED");
  if (isActive && !player.folded) badges.push("ACTING");
  return badges;
}

export default function PlayerStatusBoard({
  players = [],
  dealerIdx = 0,
  heroIndex = 0,
  turn = null,
  totalPot = 0,
  positionLabels = [],
  aiTierLabel = null,
  aiTierDescriptor = null,
}) {
  if (!players || players.length === 0) return null;

  return (
    <div
      data-testid="table-status-ledger"
      className="w-full rounded-2xl bg-black/60 p-3 text-xs text-white shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-yellow-300">
        <span>Table Status</span>
        <span className="truncate">Dealer: {players[dealerIdx]?.name ?? "-"}</span>
      </div>

      <div className="mt-2 rounded-xl bg-gray-900/85 px-3 py-2 text-xs text-slate-200">
        <div className="flex items-center justify-between">
          <span className="font-medium uppercase tracking-wide text-slate-400">Total Pot</span>
          <span className="font-semibold text-white">{totalPot}</span>
        </div>
      </div>

      <div className="mt-3 max-h-[48dvh] space-y-1.5 overflow-y-auto pr-1">
        {players.map((player, idx) => {
          const badges = statusBadges(player, idx === heroIndex, turn === idx);
          const seatLabel = positionLabels[idx] ?? `Seat ${idx + 1}`;
          const showTierBadge = idx !== heroIndex && aiTierLabel;
          return (
            <div
              key={`${player.name}-${idx}`}
              data-testid={`status-seat-${idx}`}
              className={`rounded-xl border bg-white/[0.045] px-2.5 py-2 ${
                idx === heroIndex
                  ? "border-emerald-300/70 bg-emerald-300/10"
                  : turn === idx
                    ? "border-yellow-300/70 bg-yellow-300/10"
                    : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                <span className={`truncate ${idx === heroIndex ? "text-emerald-200" : ""}`}>
                  {player.name}
                </span>
                <span className="shrink-0 text-slate-500">{seatLabel}</span>
              </div>
              <div className="mt-1 grid grid-cols-[1fr_1fr] gap-1.5 text-[11px] text-slate-200">
                <div className="flex min-w-0 justify-between gap-1 rounded bg-black/20 px-1.5 py-1">
                  <span className="text-slate-400">Stk</span>
                  <span className="font-semibold text-white">{player.stack}</span>
                </div>
                <div className="flex min-w-0 justify-between gap-1 rounded bg-black/20 px-1.5 py-1">
                  <span className="text-slate-400 truncate">
                    {player.allIn && Number(player.betThisRound ?? 0) > 0 ? "All-in" : "Bet"}
                  </span>
                  <span className="font-semibold text-white">
                    {player.betThisRound ?? 0}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                {showTierBadge && (
                  <span
                    className="rounded-full bg-indigo-900/70 px-1.5 py-0.5 text-indigo-100"
                    title={aiTierDescriptor ?? "AI tier target ranges"}
                  >
                    TIER: {aiTierLabel}
                  </span>
                )}
                {badges.length === 0 ? (
                  <span className="rounded-full bg-slate-700/80 px-1.5 py-0.5 text-slate-200">
                    READY
                  </span>
                ) : (
                  badges.map((label) => (
                    <span
                      key={label}
                      className={`rounded-full px-1.5 py-0.5 text-slate-100 ${
                        label === "ACTING"
                          ? "bg-yellow-500/90 text-black"
                          : label === "ALL-IN"
                            ? "bg-purple-600/90"
                            : label === "FOLDED"
                              ? "bg-slate-700/70 text-slate-300"
                              : "bg-slate-800/80"
                      }`}
                    >
                      {label}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
