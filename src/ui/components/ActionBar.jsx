import React from "react";
import Controls from "./Controls";

export default function ActionBar({
  phase,
  players,
  heroIndex = 0,
  turn,
  currentBet,
  onFold,
  onCall,
  onCheck,
  onRaise,
  onDraw,
  showNextButton,
  onNext,
}) {
  const hero = players?.[heroIndex];
  const canAct = hero && !hero.folded && turn === heroIndex;

  return (
    <div className="mt-8 w-full">
      <div className="w-full rounded-3xl border border-white/10 bg-slate-950/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-inner">
        <div className="flex-1">
          {canAct ? (
            phase === "BET" ? (
              <Controls
                phase="BET"
                currentBet={currentBet}
                player={hero}
                onFold={onFold}
                onCall={onCall}
                onCheck={onCheck}
                onRaise={onRaise}
              />
            ) : phase === "DRAW" ? (
              <Controls phase="DRAW" player={hero} onDraw={onDraw} />
            ) : (
              <p className="text-sm text-slate-400">ショーダウン処理中…</p>
            )
          ) : (
            <p className="text-sm text-slate-400">
              相手のアクションを待機中…
            </p>
          )}
        </div>
        {showNextButton && (
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-semibold shadow-lg hover:bg-emerald-400 transition"
          >
            Next Hand
          </button>
        )}
      </div>
    </div>
  );
}
