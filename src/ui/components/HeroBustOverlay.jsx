import React from "react";

export default function HeroBustOverlay({
  visible,
  title = "In-the-money Results",
  heroSummary,
  inMoneyPlacements = [],
  onBackToMenu,
}) {
  if (!visible) return null;
  const heroPlaceValue = heroSummary?.place ?? "?";
  const heroPlaceSuffix =
    typeof heroPlaceValue === "number"
      ? heroPlaceValue === 1
        ? "st"
        : heroPlaceValue === 2
        ? "nd"
        : heroPlaceValue === 3
        ? "rd"
        : "th"
      : "";
  const heroPlaceText = heroSummary
    ? `You finished in ${heroPlaceValue}${heroPlaceSuffix} place`
    : "You have been eliminated";
  const heroPayoutText =
    typeof heroSummary?.payout === "number"
      ? `Payout: ${heroSummary.payout}`
      : "Payout: 0";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        className="w-full max-w-xl bg-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-2xl border border-rose-400/30"
        data-testid="mtt-hero-bust-overlay"
      >
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-rose-300">
            You are eliminated
          </p>
          <h2 className="text-3xl font-bold">{title}</h2>
        </header>

        <div
          className="rounded-2xl bg-rose-500/10 border border-rose-400/40 px-4 py-3 text-center space-y-1"
          data-testid="mtt-hero-bust-hero-summary"
        >
          <p className="text-base font-semibold">{heroPlaceText}</p>
          <p className="text-sm text-rose-200">{heroPayoutText}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">In the Money</h3>
            <span className="text-sm text-slate-300">
              {inMoneyPlacements.length ? `${inMoneyPlacements.length} players` : "No payouts"}
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {inMoneyPlacements.length === 0 ? (
              <p className="text-sm text-slate-400">No players reached the payout positions.</p>
            ) : (
              inMoneyPlacements.map((entry) => (
                <div
                  key={entry.id ?? entry.place}
                  className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-2"
                  data-testid="mtt-hero-bust-itm-row"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-emerald-300">{entry.place}</span>
                    <div className="flex flex-col">
                      <span className="text-base font-semibold">{entry.name}</span>
                      <span className="text-xs text-slate-300">Stack: {entry.stack}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-yellow-300">
                    {typeof entry.payout === "number" ? `Payout ${entry.payout}` : "Payout 0"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-6 py-3 rounded-full bg-rose-500 text-white font-semibold hover:bg-rose-400 transition"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
