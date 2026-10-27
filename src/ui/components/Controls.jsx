// src/components/Controls.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  betSizing = null,
  layoutMode = "desktop",
  className,
  selectedDrawCount,
  language = 'en',
}) {
  const [selectedCommit, setSelectedCommit] = useState(
    () => betSizing?.minCommit ?? 0,
  );
  const [commitInput, setCommitInput] = useState(() => String(betSizing?.minCommit ?? 0));
  useEffect(() => {
    if (!betSizing?.enabled) return;
    setSelectedCommit(betSizing.minCommit);
    setCommitInput(String(betSizing.minCommit));
  }, [
    betSizing?.enabled,
    betSizing?.actionType,
    betSizing?.minCommit,
    betSizing?.maxCommit,
    currentBet,
    phase,
  ]);
  const betActions = useMemo(() => {
    if (phase !== "BET") return [];
    return getAvailableActions({ currentBet, player, canRaise });
  }, [phase, currentBet, player, canRaise]);

  if (!player) return null;
  const toCall = Math.max(0, Number(currentBet || 0) - Number(player.betThisRound || 0));
  const japaneseActionLabel = (action) => {
    switch (action?.variant) {
      case "fold": return "フォールド";
      case "check": return "チェック";
      case "call": return `コール ${toCall}`;
      case "allin": return `オールイン ${Math.min(Number(player.stack) || 0, toCall)}`;
      case "raise": return `${toCall > 0 ? "レイズ" : "ベット"}${betSizing?.enabled ? ` ${selectedCommit}` : ""}`;
      default: return action?.label;
    }
  };

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
    : "min-w-0 w-full whitespace-nowrap rounded px-1 py-2 text-[10px] font-medium min-[1200px]:px-1.5 min-[1200px]:text-[11px] min-[1360px]:px-2 min-[1360px]:text-xs";
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
    const rawHandler = disabled ? undefined : handlerMap[action?.handler];
    const handleClick =
      action?.handler === "onRaise" && betSizing?.enabled && rawHandler
        ? () => rawHandler(selectedCommit)
        : rawHandler;
    if (!disabled && !handleClick) return null;
    return (
      <button
        key={action?.key ?? label}
        onClick={handleClick}
        data-testid={testId ?? (!disabled && action?.key ? `action-${action.key.toLowerCase()}` : undefined)}
        disabled={disabled}
        className={`${buttonBase} ${disabled ? disabledButtonClass : resolveVariantClass(action)}`}
      >
        {language === "ja" ? japaneseActionLabel(action) : !isMobile && action?.variant === "allin" ? `All-in ${Math.min(Number(player.stack) || 0, toCall)}` : (label ?? action?.label)}
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
    const raiseLabel = betSizing?.enabled
      ? `${betSizing.actionType === "bet" ? "Bet" : "Raise"} ${selectedCommit}`
      : toCall > 0
        ? "Raise"
        : "Bet";
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

  const renderBetSizing = () => {
    const hasAggressiveAction = betActions.some(
      (action) => action?.handler === "onRaise",
    );
    if (
      phase !== "BET" ||
      !canRaise ||
      !hasAggressiveAction ||
      !betSizing?.enabled
    ) return null;
    const updateAmount = (value, preserveInput = false) => {
      const next = Math.max(
        betSizing.minCommit,
        Math.min(betSizing.maxCommit, Math.floor(Number(value) || 0)),
      );
      setSelectedCommit(next);
      setCommitInput(preserveInput ? value : String(next));
    };
    return (
      <div
        data-testid="bet-sizing-controls"
        className={`${isMobile ? "rounded-xl px-1 py-1" : "rounded-lg px-2 py-2"} bg-slate-950/70`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className={isMobile ? "grid min-w-0 flex-1 grid-cols-2 gap-1" : "flex min-w-0 flex-1 gap-1 overflow-x-auto"}>
            {betSizing.presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                data-testid={`bet-preset-${preset.key}`}
                onClick={() => updateAmount(preset.amount)}
                className={`${isMobile ? "min-h-11 min-w-0 px-1" : "min-h-9 shrink-0 px-2"} rounded-lg border py-1 text-xs font-semibold touch-manipulation ${
                  selectedCommit === preset.amount
                    ? "border-amber-300 bg-amber-300 text-slate-950"
                    : "border-white/15 bg-white/5 text-white"
                }`}
              >
                {language === "ja" ? ({ min: "最小", "half-pot": "半ポット", pot: "ポット", "all-in": "全額" }[preset.key] ?? preset.label) : preset.label} {preset.amount}
              </button>
            ))}
          </div>
          <label className={`${isMobile ? "flex flex-col items-end gap-1" : ""} shrink-0 text-[9px] uppercase tracking-wide text-slate-300`}>
            {language === "ja" ? "チップ" : "Chips"}
            <input
              type="number"
              inputMode="numeric"
              data-testid="bet-size-input"
              min={betSizing.minCommit}
              max={betSizing.maxCommit}
              value={commitInput}
              onChange={(event) => updateAmount(event.target.value, true)}
              onBlur={() => setCommitInput(String(selectedCommit))}
              className="ml-1 min-h-11 w-[72px] rounded-md border border-white/15 bg-slate-900 px-1.5 py-1 text-right text-base text-white"
            />
          </label>
        </div>
        {!isMobile && betSizing.maxCommit > betSizing.minCommit && (
          <input
            type="range"
            aria-label={language === "ja" ? "ベット金額" : "Bet size"}
            min={betSizing.minCommit}
            max={betSizing.maxCommit}
            value={selectedCommit}
            onChange={(event) => updateAmount(event.target.value)}
            className="mt-2 w-full accent-amber-400"
          />
        )}
      </div>
    );
  };

  return (
    <div className={containerClass}>
      {renderBetSizing()}
      {phase === "BET" && betActions.length > 0 && (
        isMobile ? (
          renderMobileBetActions()
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {betActions.map((action) =>
              renderBetButton(action, {
                label:
                  action.handler === "onRaise" && betSizing?.enabled
                    ? `${betSizing.actionType === "bet" ? "Bet" : "Raise"} ${selectedCommit}`
                    : null,
              }),
            )}
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
          {selectedDrawCount == null ? 'Draw Selected' : language === 'ja'
            ? (selectedDrawCount ? `${selectedDrawCount}枚を交換` : '交換しない（パット）')
            : (selectedDrawCount ? `Draw ${selectedDrawCount} cards` : 'Stand pat (keep all)')}
        </button>
      )}
    </div>
  );
}
