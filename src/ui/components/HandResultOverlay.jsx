import React from "react";

function formatAmount(value) {
  if (value == null) return "0";
  if (typeof value.toLocaleString === "function") {
    return value.toLocaleString("ja-JP");
  }
  return `${value}`;
}

function WinnerCard({ winner }) {
  const cards = Array.isArray(winner.hand) ? winner.hand : [];
  return (
    <li
      key={`${winner.seatIndex}-${winner.name}`}
      className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 flex flex-col gap-1"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold text-white">{winner.name}</span>
        <span className="text-xs text-emerald-300 uppercase tracking-wide">
          {winner.label ?? "Badugi"}
        </span>
      </div>
      {cards.length > 0 && (
        <div className="text-base tracking-[0.25em] text-white/90">{cards.join(" ")}</div>
      )}
      {winner.stack != null && (
        <p className="text-[11px] text-slate-400">Stack: {formatAmount(winner.stack)}</p>
      )}
      {typeof winner.payout === "number" && winner.payout > 0 && (
        <p className="text-[11px] text-emerald-300 uppercase tracking-[0.3em]">
          Collect ¥{formatAmount(winner.payout)}
        </p>
      )}
    </li>
  );
}

export default function HandResultOverlay({
  visible,
  summary,
  mixedInfo,
  onNext,
  buttonLabel,
}) {
  if (!visible || !summary) return null;
  const winners = summary.winners ?? [];
  const potDetails = summary.potDetails ?? [];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl bg-slate-900 rounded-3xl border border-emerald-400/40 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-300">
          <span>Hand Result</span>
          {summary.handId && <span>#{summary.handId}</span>}
        </div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-3xl font-bold text-white">
            Pot ¥{formatAmount(summary.pot ?? 0)}
          </h2>
          <span className="text-sm text-slate-400">Preparing next hand</span>
        </div>
        {potDetails.length > 0 ? (
          <div className="space-y-4 text-sm text-slate-200">
            {potDetails.map((pot, idx) => (
              <div
                key={`pot-${pot.potIndex ?? idx}`}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-[0.4em]">
                  <span>Pot #{(pot.potIndex ?? idx) + 1}</span>
                  <span>¥{formatAmount(pot.potAmount ?? 0)}</span>
                </div>
                <div className="space-y-2">
                  {(pot.winners ?? []).map((winner) => (
                    <WinnerCard key={`${winner.seatIndex}-${winner.name}`} winner={winner} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3 text-sm text-slate-200">
            {winners.map((winner) => (
              <WinnerCard key={`${winner.seatIndex}-${winner.name}`} winner={winner} />
            ))}
          </ul>
        )}
        {mixedInfo && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-xs text-slate-100 space-y-1">
            <div className="flex justify-between text-[11px] uppercase tracking-widest">
              <span>Mixed Game</span>
              <span className="text-emerald-300">{mixedInfo.profileName}</span>
            </div>
            <div className="flex justify-between">
              <span>Format</span>
              <strong className="text-sm text-white">{mixedInfo.formatLabel ?? "-"}</strong>
            </div>
            <div className="flex justify-between">
              <span>Current</span>
              <strong className="text-sm text-white">{mixedInfo.currentLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span>Next</span>
              <strong className="text-sm text-white">{mixedInfo.nextLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span>Betting</span>
              <strong className="text-sm text-white">{mixedInfo.bettingLabel ?? "-"}</strong>
            </div>
            {mixedInfo.handsRemainingText && (
              <div className="flex justify-between text-slate-300">
                <span>Remaining</span>
                <span>{mixedInfo.handsRemainingText}</span>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-2xl bg-emerald-500 py-3 text-slate-900 font-semibold hover:bg-emerald-400 transition"
        >
          {buttonLabel ?? "Next hand"}
        </button>
      </div>
    </div>
  );
}
