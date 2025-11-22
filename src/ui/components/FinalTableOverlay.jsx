import React from "react";
import { useNavigate } from "react-router-dom";

export default function FinalTableOverlay({
  open,
  stageLabel,
  remainingPlayers,
  totalEntrants,
  balancedLogs = [],
  onClose,
}) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="max-w-xl w-full rounded-3xl bg-gradient-to-br from-emerald-900 to-slate-900 border border-white/20 p-6 space-y-4 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-300">Final Table</p>
            <h2 className="text-3xl font-extrabold">{stageLabel}</h2>
          </div>
          <button
            type="button"
            className="text-slate-200 hover:text-white text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="text-sm text-slate-300">
          {remainingPlayers} players remain out of {totalEntrants}. Table balancing logs capture recent rotations.
        </p>
        <div className="space-y-2 text-xs font-mono text-slate-200">
          {balancedLogs.slice(-3).map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="flex items-center justify-between border-b border-white/10 pb-1">
              <span>{new Date(entry.timestamp).toLocaleTimeString("ja-JP")}</span>
              <span className="text-emerald-300">{entry.message}</span>
            </div>
          ))}
          {!balancedLogs.length && <div>No table reassignments yet.</div>}
        </div>
        <div className="flex gap-2 pt-3">
          <button
            type="button"
            className="flex-1 rounded-full bg-white/90 text-slate-900 font-semibold py-2"
            onClick={() => navigate("/leaderboard")}
          >
            View Leaderboard
          </button>
          <button
            type="button"
            className="flex-1 rounded-full border border-white/30 text-white py-2"
            onClick={onClose}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
