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
    <div className="w-72 rounded-3xl bg-black/65 p-4 text-sm text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-yellow-300">
        <span>Table Status</span>
        <span>Dealer: {players[dealerIdx]?.name ?? "-"}</span>
      </div>

      <div className="mt-2 rounded-2xl bg-gray-900/80 px-3 py-2 text-xs text-slate-200">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-400">Total Pot</span>
          <span className="font-semibold text-white">{totalPot}</span>
        </div>
      </div>

      <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {players.map((player, idx) => {
          const badges = statusBadges(player, idx === heroIndex, turn === idx);
          const seatLabel = positionLabels[idx] ?? `Seat ${idx + 1}`;
          const showTierBadge = idx !== heroIndex && aiTierLabel;
          return (
            <div
              key={`${player.name}-${idx}`}
              className={`rounded-2xl border border-white/5 bg-white/5 px-3 py-2 ${
                idx === heroIndex ? "border-emerald-300/60" : ""
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
                <span className={idx === heroIndex ? "text-emerald-200" : ""}>
                  {player.name}
                </span>
                <span className="text-slate-500">{seatLabel}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[0.75rem] text-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Stack</span>
                  <span className="font-semibold text-white">{player.stack}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bet</span>
                  <span className="font-semibold text-white">
                    {player.betThisRound ?? 0}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[0.65rem] uppercase tracking-wide">
                {showTierBadge && (
                  <span
                    className="rounded-full bg-indigo-900/70 px-2 py-0.5 text-indigo-100"
                    title={aiTierDescriptor ?? "AI tier target ranges"}
                  >
                    TIER: {aiTierLabel}
                  </span>
                )}
                {badges.length === 0 ? (
                  <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-slate-200">
                    READY
                  </span>
                ) : (
                  badges.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-100"
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

