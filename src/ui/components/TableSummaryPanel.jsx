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
    <div className={`text-white font-bold space-y-1 ${className}`}>
      <div>Phase: {phaseTag}</div>
      {phaseTag?.startsWith("BET") ? (
        <div>Bet Round: {Math.min((betRoundIndex ?? 0) + 1, maxDraws + 1)}/{maxDraws + 1}</div>
      ) : (
        <div>Draw Progress: {drawRound}/{maxDraws}</div>
      )}
      <div>
        Level {levelNumber}: {sbValue}/{bbValue} (Ante {anteValue})
      </div>
      <div>
        Hand {handCount}/{handsCap}
      </div>
      <div>Starting Stack: {startingStack}</div>
      {showRaiseCount && (
        <div>Raise Count (Table): {raiseCount} / 4</div>
      )}
      <div>Dealer: {dealerName}</div>
    </div>
  );
}
