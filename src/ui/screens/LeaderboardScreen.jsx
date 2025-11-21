import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRatingState } from "../hooks/useRatingState.js";
import { loadTitleSettings } from "../utils/titleSettings";
import { computeRankFromRating } from "../utils/ratingState.js";
import { exportP2PMatchesAsJSONL } from "../utils/ratingState.js";

const MODE_LABELS = {
  all: "全モード",
  ring: "Ring",
  tournament: "Tournament",
  mixed: "Mixed",
  "dealers-choice": "Dealer's Choice",
  p2p: "P2P",
};

const STAGE_LABELS = {
  store: "店舗",
  local: "地方",
  national: "全国",
  world: "世界",
};

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const ratingState = useRatingState();
  const settings = loadTitleSettings();
  const [modeFilter, setModeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredHistory = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = Array.isArray(ratingState.history) ? ratingState.history : [];
    return list
      .filter((entry) => {
        const modeMatch = modeFilter === "all" || entry.mode === modeFilter;
        if (!needle) return modeMatch;
        const text = `${entry.metadata?.variantId ?? ""} ${entry.mode} ${
          entry.metadata?.stageId ?? ""
        }`.toLowerCase();
        return modeMatch && text.includes(needle);
      })
      .slice(0, 40);
  }, [ratingState.history, modeFilter, search]);

  const rankInfo = computeRankFromRating(ratingState.globalRating);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Leaderboard</p>
          <h1 className="text-3xl font-black">Global Rating Console</h1>
          <p className="text-sm text-slate-400">
            {settings.playerName || "プレイヤー"} の現在の Global Rating は{" "}
            <strong>{Math.round(ratingState.globalRating)}</strong>（{rankInfo.label}）。
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setModeFilter(value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${
                  modeFilter === value
                    ? "bg-emerald-500 text-slate-900"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Search Variant / Stage</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="例: D03"
              className="flex-1 rounded-full bg-slate-900/60 border border-white/10 px-3 py-1 text-sm focus:outline-none focus:ring focus:ring-emerald-400/40"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/30 text-sm hover:bg-white/10 transition"
          >
            タイトルへ
          </button>
          <button
            type="button"
            onClick={() => exportP2PMatchesAsJSONL()}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400 transition"
          >
            P2P JSONL Export
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pb-16 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Match History (最新40件)</span>
            <span className="text-emerald-300">{filteredHistory.length} 件</span>
          </div>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-slate-400">履歴がありません。</p>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((entry) => {
                const metadata = entry.metadata || {};
                const stageLabel = metadata.stageId ? STAGE_LABELS[metadata.stageId] ?? metadata.stageId : "Ring";
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm grid gap-1 sm:grid-cols-3"
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] tracking-widest text-slate-400">時刻</p>
                      <p className="text-slate-100">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] tracking-widest text-slate-400">モード / ステージ</p>
                      <p className="text-slate-100">
                        {MODE_LABELS[entry.mode] ?? entry.mode} · {stageLabel}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Variant: {metadata.variantId ?? "Unknown"}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[11px] tracking-widest text-slate-400">Rating Δ</p>
                      <p className="text-slate-100">
                        Skill: {entry.deltas?.skill ?? 0} · Mixed: {entry.deltas?.mixed ?? 0}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Global → {entry.ratingAfter?.global ?? "-"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {ratingState.antiCheatAlerts?.length > 0 && (
          <div className="rounded-3xl border border-red-400/40 bg-red-900/40 p-6 space-y-3 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-red-300">Anti-Cheat Alerts</p>
            {ratingState.antiCheatAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-col gap-1 border border-red-500/30 rounded-2xl bg-red-950/40 p-3">
                <p className="text-sm text-white font-semibold">
                  {alert.reason} ({alert.severity})
                </p>
                <p className="text-xs text-red-100">{alert.detail}</p>
                <p className="text-[11px] text-slate-300">
                  モード: {MODE_LABELS[alert.mode] ?? alert.mode} · {STAGE_LABELS[alert.stageId] ?? alert.stageId}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
