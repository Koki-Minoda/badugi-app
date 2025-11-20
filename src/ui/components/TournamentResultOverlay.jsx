import React from "react";

function formatNumber(value) {
  if (value == null) return "0";
  if (typeof value.toLocaleString === "function") {
    return value.toLocaleString("ja-JP");
  }
  return `${value}`;
}

export default function TournamentResultOverlay({
  visible,
  result,
  onReturnHome,
  onReviewHistory,
  onContinueTraining,
  onReplayStage,
}) {
  if (!visible || !result) return null;
  const { stageLabel, placement, entrants, prize, feedback, reason } = result;
  const placementText = placement === 1 ? "優勝" : `${placement}位`;
  const statusLabel = reason === "champion" ? "Champion" : "Eliminated";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-2xl rounded-[2.5rem] bg-slate-950 border border-yellow-400/30 shadow-2xl p-8 space-y-6 text-white">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-yellow-300">
            Tournament Result
          </p>
          <h2 className="text-3xl font-extrabold">{stageLabel}</h2>
          <p className="text-sm text-slate-300">
            {entrants} エントリー中 {placementText} ({statusLabel})
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Placement
            </p>
            <p className="text-2xl font-bold text-white mt-1">{placementText}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Prize
            </p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">
              ¥{formatNumber(prize ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Entrants
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatNumber(entrants)}
            </p>
          </div>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/80 p-4 text-sm text-slate-200">
            {feedback}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onReturnHome}
            className="rounded-2xl bg-yellow-400/90 text-slate-950 font-semibold py-3 hover:bg-yellow-300 transition"
          >
            トーナメントロビーへ
          </button>
          <button
            type="button"
            onClick={onReviewHistory}
            className="rounded-2xl border border-white/20 text-white font-semibold py-3 hover:bg-white/10 transition"
          >
            ハンド履歴を見る
          </button>
          {onReplayStage && (
            <button
              type="button"
              onClick={onReplayStage}
              className="rounded-2xl bg-indigo-500/90 text-slate-950 font-semibold py-3 hover:bg-indigo-400 transition"
            >
              同じステージで再挑戦
            </button>
          )}
          <button
            type="button"
            onClick={onContinueTraining}
            className="rounded-2xl bg-emerald-500/90 text-slate-950 font-semibold py-3 hover:bg-emerald-400 transition"
          >
            トレーニングに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
