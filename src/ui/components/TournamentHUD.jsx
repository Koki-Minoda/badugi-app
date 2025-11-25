import React from "react";

export default function TournamentHUD({
  levelLabel,
  playersRemainingText,
  tablesActiveText,
  heroPositionText,
  payoutSummaryText = null,
  isFinalTable = false,
}) {
  return (
    <div className="w-full flex justify-center mt-4" data-testid="mtt-hud">
      <div className="w-[92%] max-w-[1400px] rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-4 flex flex-wrap gap-6 items-center text-sm text-white">
        {isFinalTable ? (
          <div
            className="flex items-center px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs font-semibold tracking-[0.3em]"
            data-testid="mtt-hud-final-table"
          >
            FINAL TABLE
          </div>
        ) : null}
        {payoutSummaryText ? (
          <div
            className="text-xs uppercase tracking-[0.35em] text-yellow-200"
            data-testid="mtt-hud-payout-summary"
          >
            {payoutSummaryText}
          </div>
        ) : null}
        <div className="flex flex-col" data-testid="mtt-hud-level">
          <span className="text-xs uppercase text-emerald-300">Level</span>
          <span className="text-base font-semibold">{levelLabel}</span>
        </div>
        <div className="flex flex-col" data-testid="mtt-hud-players-remaining">
          <span className="text-xs uppercase text-emerald-300">Players</span>
          <span className="text-base font-semibold">{playersRemainingText}</span>
        </div>
        <div className="flex flex-col" data-testid="mtt-hud-tables-active">
          <span className="text-xs uppercase text-emerald-300">Tables</span>
          <span className="text-base font-semibold">{tablesActiveText}</span>
        </div>
        <div className="flex flex-col" data-testid="mtt-hud-hero-seat">
          <span className="text-xs uppercase text-emerald-300">Hero Seat</span>
          <span className="text-base font-semibold">{heroPositionText}</span>
        </div>
      </div>
    </div>
  );
}
