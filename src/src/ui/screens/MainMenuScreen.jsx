import React from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { useMixedGame } from "../mixed/MixedGameContext.jsx";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";

const MENU_ITEMS = [
  {
    key: "ring",
    label: "Ring Table",
    description: "シートマネージャやフェルトテーマを設定して即プレイ。",
    action: (navigate) => navigate("/game"),
    badge: "Always On",
  },
  {
    key: "tournament",
    label: "Tournament Mode",
    description: "店舗→地方→全国→世界のリーグを攻略。",
    action: (navigate) => navigate("/tournament"),
    badge: "MTT",
  },
  {
    key: "mixed",
    label: "Mixed Game",
    description: "自分だけの 10-game ローテーションを作成して練習。",
    action: (navigate) => navigate("/mixed"),
    badge: "Rotation",
    requiresUnlock: true,
  },
];

const SECONDARY_ACTIONS = [
  { label: "History", description: "直近のハンド・トーナメント結果", action: (navigate) => navigate("/history") },
  { label: "Settings", description: "カード・チップ・サウンド・テーマ", action: (navigate) => navigate("/settings") },
  { label: "Profile", description: "タイトルやアバターを編集", action: (navigate) => navigate("/profile") },
];

function MenuCard({ item, locked, onClick }) {
  const palette = designTokens.colors;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`w-full rounded-3xl border text-left transition shadow-lg ${
        locked
          ? "border-white/10 bg-slate-900/40 text-slate-500 cursor-not-allowed"
          : "border-white/15 bg-slate-900/70 hover:border-emerald-400/40 hover:-translate-y-0.5 hover:bg-slate-900"
      } p-6 flex flex-col gap-3`}
      style={{ boxShadow: designTokens.elevation.card }}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-widest">
        <span className="text-emerald-300">{item.badge}</span>
        {locked ? (
          <span className="text-amber-300">LOCKED</span>
        ) : (
          <span className="text-slate-400">Tap to launch</span>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-white">{item.label}</h3>
        <p className="text-sm text-slate-300 mt-1">{item.description}</p>
      </div>
      {locked && (
        <p className="text-xs text-amber-300">
          世界大会を優勝すると解放されます。
        </p>
      )}
    </button>
  );
}

export default function MainMenuScreen() {
  const navigate = useNavigate();
  const { activeProfile } = useMixedGame();
  const playerProgress = usePlayerProgress();
  const unlock = computeUnlockState(playerProgress);
  const tokens = designTokens;

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${tokens.colors.surface} 0%, ${tokens.colors.background} 60%)`,
      }}
    >
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">Main Menu</p>
          <h1 className="text-4xl font-extrabold text-white">Badugi Practice Hub</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-full border border-white/20 text-sm text-white hover:bg-white/10 transition"
          >
            Title
          </button>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="px-4 py-2 rounded-full border border-emerald-400/50 text-sm text-emerald-200 hover:bg-emerald-400/10 transition"
          >
            Quick Settings
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MENU_ITEMS.map((item) => {
            const locked = item.requiresUnlock ? unlock.mixedGameLocked : false;
            return (
              <MenuCard
                key={item.key}
                item={item}
                locked={locked}
                onClick={() => !locked && item.action(navigate)}
              />
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {SECONDARY_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => action.action(navigate)}
              className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 text-left hover:border-emerald-300/30 transition"
            >
              <p className="text-sm uppercase tracking-widest text-slate-400">{action.label}</p>
              <p className="text-white text-lg font-semibold">{action.description}</p>
            </button>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-300">Unlock Status</p>
              <p className="text-white text-2xl font-bold">
                {unlock.worldChampCleared ? "All advanced modes unlocked" : "世界大会優勝で解放"}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              {["Mixed Game", "Multi-Game", "Dealer's Choice"].map((label, idx) => {
                const locked =
                  idx === 0
                    ? unlock.mixedGameLocked
                    : idx === 1
                    ? unlock.multiGameLocked
                    : unlock.dealerChoiceLocked;
                return (
                  <span
                    key={label}
                    className={`px-3 py-1 rounded-full ${
                      locked
                        ? "bg-slate-800 text-slate-500"
                        : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {label}: {locked ? "LOCKED" : "READY"}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 text-sm text-slate-300">
            {unlock.chain.map((step) => (
              <div
                key={step.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {step.label}
                </p>
                <p className="text-white text-lg font-semibold">
                  {step.current} / {step.required}
                </p>
              </div>
            ))}
          </div>
        </section>

        {activeProfile && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">Active Mixed Profile</p>
            <div className="flex flex-wrap items-center gap-3 text-white text-lg font-semibold">
              {activeProfile.name}
              <span className="text-slate-400 text-sm font-normal">
                {activeProfile.selectedGameIds.length} games / {activeProfile.handsPerGame} hands each
              </span>
            </div>
            <p className="text-sm text-slate-400">
              モード切り替え: {activeProfile.selectionMode === "RANDOM" ? "Dealer's Choice" : "Fixed order"}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
