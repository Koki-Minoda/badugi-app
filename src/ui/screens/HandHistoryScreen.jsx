import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentHandHistorySnapshot,
  getHandHistoryBufferSnapshot,
} from "../App.jsx";

function formatTimestamp(ts) {
  if (!Number.isFinite(ts)) return "–";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return `${ts}`;
  }
}

function extractHandEndEvent(hand) {
  if (!hand?.events) return null;
  for (let i = hand.events.length - 1; i >= 0; i -= 1) {
    const evt = hand.events[i];
    if (evt?.type === "HAND_END") {
      return evt;
    }
  }
  return null;
}

function HandHistoryRow({ entry, onReplay }) {
  const { hand, isLive } = entry;
  const handEnd = extractHandEndEvent(hand);
  const winners =
    handEnd?.winners && handEnd.winners.length
      ? handEnd.winners
          .map((winner) => `Seat ${winner.seat}: +${winner.amount}`)
          .join(", ")
      : "—";
  const totalPot = handEnd?.totalPot ?? "—";

  return (
    <button
      type="button"
      className={`w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white transition hover:bg-white/5 ${
        isLive ? "ring-1 ring-emerald-400/40" : ""
      }`}
      onClick={() => onReplay(hand?.handId)}
      disabled={!hand?.handId}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">{hand?.handId ?? "unknown"}</div>
        <div className="text-xs uppercase tracking-[0.35em] text-white/60">
          {formatTimestamp(hand?.startedAt)}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
        <span>Hand #{hand?.handCount ?? "—"}</span>
        <span>BTN {hand?.buttonSeat ?? "—"}</span>
        <span>SB {hand?.sbSeat ?? "—"}</span>
        <span>BB {hand?.bbSeat ?? "—"}</span>
        {isLive && (
          <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            LIVE
          </span>
        )}
      </div>
      <div className="mt-2 grid gap-2 text-xs text-white/70 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">ENDED</p>
          <p>{formatTimestamp(hand?.endedAt)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">WINNERS · POT</p>
          <p className="line-clamp-2 text-emerald-200">
            {winners} · Pot {totalPot}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function HandHistoryScreen({ onClose = () => {}, onReplay = () => {} }) {
  const [filterMode, setFilterMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveHandSnapshot, setLiveHandSnapshot] = useState(null);
  const [completedSnapshotList, setCompletedSnapshotList] = useState([]);

  const refreshSnapshots = useCallback(() => {
    setLiveHandSnapshot(getCurrentHandHistorySnapshot());
    setCompletedSnapshotList(getHandHistoryBufferSnapshot() ?? []);
  }, []);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const rows = useMemo(() => {
    const items = [];
    if (liveHandSnapshot) {
      items.push({
        hand: liveHandSnapshot,
        isLive: true,
        key: `live-${liveHandSnapshot.handId ?? "unknown"}`,
      });
    }
    const sorted = [...(completedSnapshotList ?? [])].sort(
      (a, b) => (b?.startedAt ?? 0) - (a?.startedAt ?? 0),
    );
    sorted.forEach((hand, idx) => {
      items.push({ hand, isLive: false, key: hand?.handId ?? `hist-${idx}` });
    });
    return items;
  }, [liveHandSnapshot, completedSnapshotList]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return rows.filter((entry) => {
      if (filterMode === "live" && !entry.isLive) return false;
      if (filterMode === "completed" && entry.isLive) return false;
      if (!normalizedQuery) return true;
      const id = entry?.hand?.handId ?? "";
      return typeof id === "string" && id.toLowerCase().includes(normalizedQuery);
    });
  }, [rows, filterMode, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">MGX</p>
            <h1 className="text-2xl font-semibold text-white">Hand History</h1>
            <p className="text-sm text-slate-300/80">
              Review the live hand plus recently completed hands. Tap any row to open the replay.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={refreshSnapshots}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={onClose}
            >
              Back
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-white/60">Search</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search handId…"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/60">Filter</p>
            <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              {[{ label: "All", value: "all" }, { label: "LIVE", value: "live" }, { label: "Completed", value: "completed" }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-lg transition ${
                    filterMode === option.value
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setFilterMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredRows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
              {rows.length === 0
                ? "No hands recorded yet. Play a hand and return to see the history."
                : "No hands match your search/filter."}
            </div>
          )}
          {filteredRows.map((entry) => (
            <HandHistoryRow key={entry.key} entry={entry} onReplay={onReplay} />
          ))}
        </div>
      </div>
    </div>
  );
}
