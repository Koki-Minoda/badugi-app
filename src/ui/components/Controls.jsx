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
  canRaise = true,
  layoutMode = "desktop",
  className,
}) {
  const betActions = useMemo(() => {
    if (phase !== "BET") return [];
    return getAvailableActions({ currentBet, player, canRaise });
  }, [phase, currentBet, player, canRaise]);

  if (!player) return null;

  if (phase === "BET" && betActions.length === 0) {
    return null;
  }

  const isMobile = String(layoutMode).startsWith("mobile");
  const containerClass =
    className ??
    (isMobile
      ? "w-full flex flex-col gap-3"
      : "flex flex-col gap-2 bg-gray-800/90 p-2 rounded shadow-lg");
  const buttonBase = isMobile
    ? "min-h-[46px] max-h-[52px] w-full min-w-0 flex-1 px-1.5 py-2 rounded-xl text-[clamp(11px,3.4vw,14px)] font-semibold leading-tight tracking-normal touch-manipulation"
    : "px-3 py-2 rounded text-sm font-medium";
  const disabledButtonClass =
    "border border-white/10 bg-slate-700/55 text-slate-400 cursor-not-allowed opacity-65";

  const resolveVariantClass = (action) => {
    switch (action?.variant) {
      case "fold":
        return isMobile
          ? "bg-slate-800 text-white border border-white/10"
          : "bg-gray-700 text-white";
      case "call":
        return "bg-blue-600 text-white";
      case "allin":
        return "bg-purple-600 text-white";
      case "check":
        return isMobile
          ? "bg-yellow-400 text-black"
          : "bg-yellow-500 text-black";
      case "raise":
        return "bg-red-600 text-white";
      default:
        return "bg-slate-700 text-white";
    }
  };

  const renderBetButton = (action, { disabled = false, label = null, testId = null } = {}) => {
    const handlerMap = {
      onFold,
      onCall,
      onCheck,
      onRaise,
    };
    const handleClick = disabled ? undefined : handlerMap[action?.handler];
    if (!disabled && !handleClick) return null;
    return (
      <button
        key={action?.key ?? label}
        onClick={handleClick}
        data-testid={testId ?? (!disabled && action?.key ? `action-${action.key.toLowerCase()}` : undefined)}
        disabled={disabled}
        className={`${buttonBase} ${disabled ? disabledButtonClass : resolveVariantClass(action)}`}
      >
        {label ?? action?.label}
      </button>
    );
  };

  const renderMobileBetActions = () => {
    const foldAction = betActions.find((action) => action.variant === "fold");
    const callOrCheckAction = betActions.find((action) =>
      ["call", "allin", "check"].includes(action.variant),
    );
    const raiseAction = betActions.find((action) => action.variant === "raise");
    const playerBet = typeof player?.betThisRound === "number" ? player.betThisRound : 0;
    const toCall = Math.max(0, Number(currentBet || 0) - playerBet);
    const raiseLabel = toCall > 0 ? "Raise" : "Bet";
    const slots = [
      foldAction
        ? renderBetButton(foldAction, { testId: "action-fold" })
        : renderBetButton({ key: "FOLD_DISABLED", variant: "fold" }, { disabled: true, label: "Fold" }),
      callOrCheckAction
        ? renderBetButton(callOrCheckAction)
        : renderBetButton(
            { key: "CALL_DISABLED", variant: "call" },
            { disabled: true, label: toCall > 0 ? "Call" : "Check" },
          ),
      raiseAction
        ? renderBetButton(raiseAction, { label: raiseLabel, testId: "action-raise" })
        : renderBetButton({ key: "RAISE_DISABLED", variant: "raise" }, { disabled: true, label: raiseLabel }),
    ];
    return <div className="grid w-full grid-cols-3 gap-1.5">{slots}</div>;
  };

  return (
    <div className={containerClass}>
      {phase === "BET" && betActions.length > 0 && (
        isMobile ? (
          renderMobileBetActions()
        ) : (
          <div className="flex gap-2">
            {betActions.map((action) => renderBetButton(action))}
          </div>
        )
      )}
      {phase === "DRAW" && (
        <button
          onClick={onDraw}
          data-testid="action-draw-selected"
          disabled={!canDraw}
          className={`${
            isMobile
              ? "min-h-[44px] w-full py-[clamp(8px,2dvw,12px)] rounded-2xl font-semibold text-[clamp(12px,2.1dvw,16px)] touch-manipulation"
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
