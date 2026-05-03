import React from "react";

export default function TableSummaryPanel({
  phaseTag,
  drawRound,
  maxDraws,
  levelNumber,
  sbValue,
  bbValue,
  anteValue,
  handCount,
  handsCap,
  startingStack,
  showRaiseCount,
  raiseCount,
  dealerName,
  betRoundIndex,
  className = "",
}) {
  return (
    <div
      data-testid="table-summary-panel"
      className={`rounded-2xl bg-black/65 p-3 text-xs text-white shadow-xl ${className}`}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-950/70 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Phase</p>
          <p className="truncate text-sm font-bold">{phaseTag}</p>
        </div>
        <div className="rounded-xl bg-slate-950/70 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">
            {phaseTag?.startsWith("BET") ? "Bet Round" : "Draw"}
          </p>
          <p className="text-sm font-bold">
            {phaseTag?.startsWith("BET")
              ? `${Math.min((betRoundIndex ?? 0) + 1, maxDraws + 1)}/${maxDraws + 1}`
              : `${drawRound}/${maxDraws}`}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] font-semibold text-slate-100">
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Level</span>
          <span>{levelNumber}: {sbValue}/{bbValue} (Ante {anteValue})</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Hand</span>
          <span>{handCount}/{handsCap}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Start</span>
          <span>{startingStack}</span>
        </div>
      </div>
      {showRaiseCount && (
        <div className="mt-2 rounded-xl bg-yellow-400/10 px-2 py-1 text-[11px] font-semibold text-yellow-100">
          Raise Count: {raiseCount} / 4
        </div>
      )}
      <div className="mt-2 truncate text-[11px] font-semibold text-slate-300">
        Dealer: {dealerName}
      </div>
    </div>
  );
}
