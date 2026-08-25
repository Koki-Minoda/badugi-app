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
  const normalizedPhaseTag = String(phaseTag ?? "").toUpperCase();
  const isDrawPhase = normalizedPhaseTag.startsWith("DRAW");
  const phasePanelClass = isDrawPhase
    ? "border border-red-300/45 bg-red-950/75 shadow-[0_0_18px_rgba(248,113,113,0.22)]"
    : "bg-black/65";
  const phaseCardClass = isDrawPhase
    ? "border border-red-300/35 bg-red-600/20"
    : "bg-slate-950/70";
  return (
    <div
      data-testid="table-summary-panel"
      className={`rounded-2xl p-3 text-xs text-white shadow-xl ${phasePanelClass} ${className}`}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl px-2 py-1.5 ${phaseCardClass}`}>
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Phase</p>
          <p className="truncate text-sm font-bold">{phaseTag}</p>
          {isDrawPhase && (
            <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-red-200">
              Draw Rusher
            </p>
          )}
        </div>
        <div className={`rounded-xl px-2 py-1.5 ${phaseCardClass}`}>
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
