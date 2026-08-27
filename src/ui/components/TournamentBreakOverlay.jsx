import React, { useEffect, useMemo, useState } from "react";

function remainingSeconds(endsAt, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(endsAt) - now) / 1000));
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function TournamentBreakOverlay({ breakState, onComplete }) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(breakState?.endsAt));
  const endsAt = breakState?.endsAt;

  useEffect(() => {
    setSeconds(remainingSeconds(endsAt));
    if (!endsAt) return undefined;
    const update = () => {
      const next = remainingSeconds(endsAt);
      setSeconds(next);
      if (next === 0) onComplete?.();
    };
    const timer = window.setInterval(update, 250);
    update();
    return () => window.clearInterval(timer);
  }, [endsAt, onComplete]);

  const clock = useMemo(() => formatClock(seconds), [seconds]);
  if (!breakState) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      data-testid="tournament-break-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Tournament break"
    >
      <div className="w-full max-w-sm rounded-2xl border border-yellow-300/40 bg-slate-950 p-6 text-center text-white shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">
          Tournament Break
        </p>
        <h2 className="mt-3 text-2xl font-black">休憩</h2>
        <p className="mt-2 text-sm text-slate-300">
          Level {breakState.afterLevel} 終了
        </p>
        <p className="mt-5 font-mono text-5xl font-black" data-testid="tournament-break-clock">
          {clock}
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-yellow-300 px-4 py-3 text-sm font-black text-slate-950"
          onClick={onComplete}
        >
          休憩を終了して続ける
        </button>
      </div>
    </div>
  );
}
