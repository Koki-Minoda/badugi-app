// src/components/Controls.jsx
import React from "react";

export default function Controls({
  phase,
  currentBet,
  player,
  onFold,
  onCall,
  onCheck,
  onRaise,
  onDraw,
  canDraw = true,
  layoutMode = "desktop",
  className,
}) {
  if (!player) return null;

  const isMobile = layoutMode === "mobile";
  const containerClass =
    className ??
    (isMobile
      ? "w-full flex flex-col gap-3"
      : "flex flex-col gap-2 bg-gray-800/90 p-2 rounded shadow-lg");
  const buttonBase = isMobile
    ? "flex-1 py-3 rounded-2xl text-base font-semibold tracking-wide"
    : "px-3 py-2 rounded text-sm font-medium";

  return (
    <div className={containerClass}>
      {phase === "BET" && (
        <div
          className={`flex ${
            isMobile ? "gap-3 w-full flex-col sm:flex-row" : "gap-2"
          }`}
        >
          <button
            onClick={onFold}
            className={`${buttonBase} ${
              isMobile
                ? "bg-slate-800 text-white border border-white/10"
                : "bg-gray-700 text-white"
            }`}
          >
            Fold
          </button>
          {currentBet > player.betThisRound ? (
            <button
              onClick={onCall}
              className={`${buttonBase} ${
                isMobile ? "bg-blue-600 text-white" : "bg-blue-600 text-white"
              }`}
            >
              Call
            </button>
          ) : (
            <button
              onClick={onCheck}
              className={`${buttonBase} ${
                isMobile ? "bg-yellow-400 text-black" : "bg-yellow-500 text-black"
              }`}
            >
              Check
            </button>
          )}
          <button
            onClick={onRaise}
            className={`${buttonBase} ${
              isMobile ? "bg-red-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            Raise
          </button>
        </div>
      )}
      {phase === "DRAW" && (
        <button
          onClick={onDraw}
          disabled={!canDraw}
          className={`${
            isMobile
              ? "w-full py-3 rounded-2xl font-semibold text-base"
              : "px-4 py-2 rounded-lg font-bold whitespace-nowrap"
          } ${
            canDraw
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-slate-600 text-slate-300 cursor-not-allowed opacity-70"
          }`}
        >
          Draw Selected
        </button>
      )}
    </div>
  );
}
