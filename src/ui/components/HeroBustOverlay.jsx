import React from "react";
import { TournamentReviewSection } from "./TournamentResultOverlay.jsx";
import { displayTournamentTitle, getTournamentResultCopy } from "./tournamentResultCopy.js";

export default function HeroBustOverlay({
  visible,
  title,
  language,
  heroSummary,
  inMoneyPlacements = [],
  tournamentReview = null,
  onOpenReviewReplay,
  onBackToMenu,
}) {
  if (!visible) return null;
  const copy = getTournamentResultCopy(language);
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
    ? copy.finishedPlace(heroPlaceValue, heroPlaceSuffix)
    : copy.eliminatedSummary;
  const heroPayoutText =
    typeof heroSummary?.payout === "number"
      ? copy.payout(heroSummary.payout)
      : copy.payout(0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-rose-400/30 bg-slate-900 text-white shadow-2xl"
        data-testid="mtt-hero-bust-overlay"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" data-testid="mtt-hero-bust-scroll-content">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-rose-300">
            {copy.eliminated}
          </p>
          <h2 className="text-xl font-bold sm:text-2xl">{displayTournamentTitle(title, language, copy.inTheMoneyResults)}</h2>
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
            <h3 className="text-lg font-semibold">{copy.inTheMoney}</h3>
            <span className="text-sm text-slate-300">
              {inMoneyPlacements.length ? copy.players(inMoneyPlacements.length) : copy.noPayouts}
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {inMoneyPlacements.length === 0 ? (
              <p className="text-sm text-slate-400">{copy.noPaidPlayers}</p>
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
                      <span className="text-xs text-slate-300">{copy.stack(entry.stack)}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-yellow-300">
                    {copy.payoutRow(typeof entry.payout === "number" ? entry.payout : 0)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {tournamentReview ? (
          <TournamentReviewSection
            tournamentReview={tournamentReview}
            onOpenReviewReplay={onOpenReviewReplay}
            language={language}
          />
        ) : null}

        </div>
        <div className="flex shrink-0 justify-center border-t border-white/10 px-4 py-3">
          <button
            type="button"
            data-testid="mtt-back-to-menu"
            onClick={onBackToMenu}
            className="min-h-[44px] px-6 py-3 rounded-full bg-rose-500 text-white font-semibold hover:bg-rose-400 transition"
          >
            {copy.backToMenu}
          </button>
        </div>
      </div>
    </div>
  );
}
