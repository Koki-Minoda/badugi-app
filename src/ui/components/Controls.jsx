// src/components/Controls.jsx
import React, { useMemo } from "react";
import getAvailableActions from "../utils/getAvailableActions.js";

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

  const betActions = useMemo(() => {
    if (phase !== "BET") return [];
    return getAvailableActions({ currentBet, player });
  }, [phase, currentBet, player]);

  if (phase === "BET" && betActions.length === 0) {
    return null;
  }

  const isMobile = layoutMode === "mobile";
  const containerClass =
    className ??
    (isMobile
      ? "w-full flex flex-col gap-3"
      : "flex flex-col gap-2 bg-gray-800/90 p-2 rounded shadow-lg");
  const buttonBase = isMobile
    ? "flex-1 py-[clamp(10px,3vw,14px)] rounded-2xl text-[clamp(12px,3vw,16px)] font-semibold tracking-wide"
    : "px-3 py-2 rounded text-sm font-medium";

  return (
    <div className={containerClass}>
      {phase === "BET" && betActions.length > 0 && (
        <div
          className={`flex ${
            isMobile ? "gap-3 w-full flex-col sm:flex-row" : "gap-2"
          }`}
        >
          {betActions.map((action) => {
            const handlerMap = {
              onFold,
              onCall,
              onCheck,
              onRaise,
            };
            const handleClick = handlerMap[action.handler];
            if (!handleClick) return null;

            let variantClass = "";
            switch (action.variant) {
              case "fold":
                variantClass = isMobile
                  ? "bg-slate-800 text-white border border-white/10"
                  : "bg-gray-700 text-white";
                break;
              case "call":
                variantClass = "bg-blue-600 text-white";
                break;
              case "allin":
                variantClass = "bg-purple-600 text-white";
                break;
              case "check":
                variantClass = isMobile
                  ? "bg-yellow-400 text-black"
                  : "bg-yellow-500 text-black";
                break;
              case "raise":
                variantClass = "bg-red-600 text-white";
                break;
              default:
                variantClass = "bg-slate-700 text-white";
            }

            return (
              <button
                key={action.key}
                onClick={handleClick}
                className={`${buttonBase} ${variantClass}`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
      {phase === "DRAW" && (
        <button
          onClick={onDraw}
          disabled={!canDraw}
          className={`${
            isMobile
              ? "w-full py-[clamp(10px,3vw,14px)] rounded-2xl font-semibold text-[clamp(12px,3vw,16px)]"
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
