import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { computeBasicStats } from "../utils/history";

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-inner">
      <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

export default function ProfileStats() {
  const navigate = useNavigate();
  const stats = useMemo(() => computeBasicStats(), []);
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">プロフィール</p>
            <h1 className="text-3xl font-extrabold mt-2">トーナメントKPI</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="rounded-full border border-white/25 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/90 transition hover:border-emerald-300/70 hover:text-emerald-200"
          >
            ゲーム選択へ戻る
          </button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <StatCard label="トーナメント数" value={stats.tournaments} />
          <StatCard label="ITM回数" value={stats.itmCount} />
          <StatCard label="ITM率" value={`${(stats.itmRate * 100).toFixed(1)}%`} />
          <StatCard label="総バイイン" value={fmtJpy(stats.totalBuyIn)} />
          <StatCard label="総賞金" value={fmtJpy(stats.totalPrize)} />
          <StatCard label="ROI" value={`${(stats.roi * 100).toFixed(1)}%`} />
        </div>
        <p className="text-xs text-slate-400">
          今後は VPIP / PFR / Aggression 等の詳細指標も追加予定です。
        </p>
      </div>
    </div>
  );
}

function fmtJpy(n) {
  if (typeof n !== "number") return "-";
  try {
    return n.toLocaleString("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    });
  } catch {
    return n.toLocaleString();
  }
}
