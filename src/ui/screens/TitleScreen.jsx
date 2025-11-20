import React from "react";
import { useNavigate } from "react-router-dom";
import { loadTitleSettings } from "../utils/titleSettings";
import { designTokens } from "../../styles/designTokens.js";
import { useRatingState } from "../hooks/useRatingState.js";
import { computeRankFromRating } from "../utils/ratingState.js";

const heroHighlights = [
  "Seat Manager & HUD",
  "RL 向け JSONL ログ",
  "Mixed Game ローテ",
  "Tournament Structure",
];

export default function TitleScreen() {
  const navigate = useNavigate();
  const settings = loadTitleSettings();
  const ratingState = useRatingState();
  const rankInfo = computeRankFromRating(ratingState.globalRating);
  const nextTierLabel = rankInfo.nextTier ? rankInfo.nextTier.label : "MAX";
  const progressPercent = Math.round((rankInfo.progress ?? 0) * 100);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: `linear-gradient(160deg, ${designTokens.colors.background}, #040a16 55%, #020617 100%)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <header className="max-w-5xl w-full mx-auto px-6 pt-10 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Badugi Practice</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2">BADUGI APP</h1>
        </div>
        <div className="text-right text-xs text-slate-400 space-y-1">
          <p>Version 0.9.0</p>
          <p>プレイヤー: {settings.playerName || "You"}</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
        <section className="space-y-5 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
            プロ仕様のバドゥーギ練習台でスピード感ある MTT / Ring トレーニングを。
          </h2>
          <p className="text-slate-300 leading-relaxed">
            ブラインド構造、Seat Manager、Mixed Game ローテーション、RL ログなど、すべての
            コンポーネントを一つのフローに収めました。START を押すと Main Menu に遷移し、
            Ring / Tournament / Mixed / Catalog などのモードを選択できます。
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 text-slate-200 text-sm">
            {heroHighlights.map((item) => (
              <li key={item} className="flex items-center gap-2 justify-center">
                <span className="text-emerald-400 text-base">●</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-4xl">
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-2xl text-left">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Global Rating</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-white">
                    {ratingState.globalRating?.toFixed ? ratingState.globalRating.toFixed(0) : ratingState.globalRating ?? 1500}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold tracking-wide">
                    {rankInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  次のランク: {nextTierLabel} ／ 進捗 {progressPercent}%
                </p>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm text-slate-100 w-full lg:max-w-xl">
                <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Skill</p>
                  <p className="text-2xl font-semibold text-white">{Math.round(ratingState.skillRating ?? 1500)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Mixed</p>
                  <p className="text-2xl font-semibold text-white">{Math.round(ratingState.mixedRating ?? 1500)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Style</p>
                  <p className="text-2xl font-semibold text-white">
                    {Math.round(ratingState.styleRating ?? 50)}
                    <span className="text-xs ml-1 text-slate-300">{ratingState.styleProfile || "Balanced"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/leaderboard")}
                className="px-6 py-3 rounded-2xl border border-white/20 text-sm font-semibold text-slate-200 hover:bg-white/10 transition"
              >
                Leaderboard
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-col md:flex-row gap-4">
          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="px-10 py-4 rounded-full bg-emerald-500 text-slate-900 text-lg font-semibold shadow-xl hover:bg-emerald-400 transition"
          >
            START
          </button>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="px-10 py-4 rounded-full border border-white/20 text-lg font-semibold hover:bg-white/10 transition"
          >
            Settings
          </button>
        </div>
      </main>
    </div>
  );
}
