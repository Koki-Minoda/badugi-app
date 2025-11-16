import React from "react";
import { useNavigate } from "react-router-dom";
import { loadTitleSettings } from "../utils/titleSettings";

const features = [
  "完全自動のBET/DRAW進行",
  "対戦ログのJSONLエクスポート",
  "RL向けハンド履歴",
  "カスタム HUD / Seat Manager",
];

export default function TitleScreen() {
  const navigate = useNavigate();
  const settings = loadTitleSettings();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-wide">Badugi App</h1>
        <nav className="flex gap-3 text-sm font-semibold">
          <button
            onClick={() => navigate("/settings")}
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            Settings
          </button>
          <button
            onClick={() => navigate("/history")}
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            History
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-emerald-300">ハイスピード・バドゥーギ</p>
            <h2 className="text-4xl lg:text-5xl font-bold mt-2">プロトーナメント向けの練習台</h2>
          </div>
          <p className="text-slate-300 leading-relaxed">
            HUD、履歴、RL 連携まで含めた Badugi 練習用テーブルです。座席 / チップ /
            設定を自由にアレンジしながら、自分だけのチームを育てましょう。
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 text-slate-200">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="text-emerald-400 text-lg">◆</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => navigate("/game")}
              className="px-6 py-3 bg-emerald-500 text-slate-900 font-bold rounded-xl shadow-lg hover:bg-emerald-400 transition"
            >
              PLAY NOW
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="px-6 py-3 bg-white/10 border border-white/30 rounded-xl hover:bg-white/20 transition"
            >
              Customize Profile
            </button>
            <button
              onClick={() => navigate("/tournament")}
              className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-400 transition"
            >
              Tournament Mode
            </button>
          </div>
        </section>

        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-widest text-emerald-300">Current Profile</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-5xl">{settings.avatar}</div>
            <div>
              <h3 className="text-2xl font-bold">{settings.playerName}</h3>
              <span className="inline-flex mt-2 px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-300 text-xs uppercase tracking-wide">
                {settings.playerTitle}
              </span>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-200">
            <p>プレイデータはローカルに保存され、いつでも再開できます。</p>
            <p>Settings からフェルトテーマやアバターを調整できます。</p>
          </div>
        </section>
      </main>
    </div>
  );
}
