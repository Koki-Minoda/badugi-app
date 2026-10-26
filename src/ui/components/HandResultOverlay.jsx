import ReviewBookmarkButton from "../review/ReviewBookmarkButton.jsx";
import React from "react";
import { getHandResultCopy, localizeResultHandLabel } from "./handResultCopy.js";

function formatAmount(value) {
  if (value == null) return "0";
  if (typeof value.toLocaleString === "function") {
    return value.toLocaleString("ja-JP");
  }
  return `${value}`;
}

const COMPONENT_TONES = {
  badugi: "violet",
  low27: "cyan",
  lowA5: "cyan",
  archieHigh: "amber",
  archieLow: "cyan",
  archieChop: "emerald",
  board: "amber",
  draw: "cyan",
};

const COMPONENT_SECTION_CLASSES = {
  emerald: "border-emerald-300/25 bg-emerald-950/20",
  amber: "border-amber-300/35 bg-amber-950/25",
  cyan: "border-cyan-300/35 bg-cyan-950/25",
  violet: "border-violet-300/35 bg-violet-950/25",
};

const COMPONENT_DETAIL_CLASSES = {
  emerald: "border-emerald-300/20 bg-emerald-300/8 text-emerald-50",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-50",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-50",
  violet: "border-violet-300/25 bg-violet-300/10 text-violet-50",
};

function getComponentLabel(source = {}, copy = getHandResultCopy("en")) {
  if (source.component && copy.components[source.component]) return copy.components[source.component];
  if (source.componentLabel) return source.componentLabel;
  if (source.label && /\bhalf\b/i.test(source.label)) return source.label;
  return null;
}

function getComponentTone(source = {}) {
  return COMPONENT_TONES[source.component] ?? (getComponentLabel(source) ? "emerald" : "emerald");
}

function getBasePotTitle(pot = {}, index, singlePot, copy) {
  const sourcePotIndex = Number.isInteger(pot.sourcePotIndex) ? pot.sourcePotIndex : (pot.potIndex ?? index);
  if (singlePot && !getComponentLabel(pot)) return copy.pot;
  if (sourcePotIndex === 0) return singlePot ? copy.pot : copy.mainPot;
  if (sourcePotIndex === 1) return copy.sidePot;
  return `${copy.sidePot} ${sourcePotIndex}`;
}

function getPotTitle(pot = {}, index, singlePot, copy) {
  const baseTitle = getBasePotTitle(pot, index, singlePot, copy);
  const componentLabel = getComponentLabel(pot, copy);
  return componentLabel ? `${baseTitle} · ${componentLabel}` : baseTitle;
}

function getSeatListLabel(seatIndexes = [], copy, players = [], heroSeat = null, language = "en") {
  if (!Array.isArray(seatIndexes) || seatIndexes.length === 0) return "";
  return seatIndexes
    .filter((seatIndex) => Number.isInteger(seatIndex))
    .map((seatIndex) => (
      seatIndex === heroSeat
        ? (language === "ja" ? "あなた" : "You")
        : players[seatIndex]?.name ?? `${copy.seat}${seatIndex + 1}`
    ))
    .join(" / ");
}

function getOddChipAmount(source = {}) {
  const raw = source.oddChipAmount ?? source.oddChip?.amount ?? 0;
  return Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

function getOddChipLabel(pot = {}, copy) {
  const oddChipAmount = getOddChipAmount(pot);
  if (oddChipAmount <= 0) return "";
  return copy.oddChip(formatAmount(oddChipAmount), getComponentLabel(pot, copy));
}

function WinnerCard({ winner, tone = "emerald", language, copy }) {
  const cards = Array.isArray(winner.hand) ? winner.hand : [];
  const activeCards = Array.isArray(winner.activeCards) ? winner.activeCards : cards;
  const deadCards = Array.isArray(winner.deadCards) ? winner.deadCards : [];
  const winnerName =
    winner.name ??
    (Number.isInteger(winner.seatIndex) ? `${copy.seat}${winner.seatIndex + 1}` : copy.winner);
  const handLabel = localizeResultHandLabel(winner.handLabel ?? winner.evaluation?.handName ?? copy.winner, language);
  const componentLabel = getComponentLabel(winner, copy);
  const toneClasses = {
    emerald: "border-emerald-300/25 bg-emerald-950/20",
    amber: "border-amber-300/30 bg-amber-950/20",
    cyan: "border-cyan-300/30 bg-cyan-950/20",
    violet: "border-violet-300/30 bg-violet-950/20",
  };
  return (
    <li
      key={`${winner.seatIndex}-${winnerName}`}
      className={`rounded-2xl border px-4 py-3 flex flex-col gap-1.5 ${
        toneClasses[tone] ?? toneClasses.emerald
      }`}
      data-testid="hand-result-winner-row"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold text-white" data-testid="hand-result-winner-name">
          {winnerName}
        </span>
        <span
          className="text-xs text-emerald-300 uppercase tracking-wide"
          data-testid="hand-result-winner-hand-label"
        >
          {handLabel}
        </span>
      </div>
      {componentLabel && (
        <span
          className="w-fit rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-200"
          data-testid="hand-result-winner-component"
        >
          {componentLabel}
        </span>
      )}
      {winner.ranksLabel && winner.ranksLabel !== "-" && (
        <div
          className="text-xs text-slate-300 uppercase tracking-[0.35em]"
          data-testid="hand-result-winner-ranks"
        >
          {winner.ranksLabel}
        </div>
      )}
      {activeCards.length > 0 && (
        <div
          className="text-base tracking-[0.25em] text-white/90"
          data-testid="hand-result-winner-active-cards"
        >
          {activeCards.join(" ")}
        </div>
      )}
      {deadCards.length > 0 && (
        <div
          className="text-xs text-slate-500 tracking-[0.25em]"
          data-testid="hand-result-winner-dead-cards"
        >
          {copy.dead}: {deadCards.join(" ")}
        </div>
      )}
      {cards.length > 0 && activeCards.length === 0 && (
        <div className="text-base tracking-[0.25em] text-white/90">{cards.join(" ")}</div>
      )}
      {winner.stack != null && (
        <p className="text-[11px] text-slate-400">{copy.stack}: {copy.chips(formatAmount(winner.stack))}</p>
      )}
      {typeof winner.payout === "number" && winner.payout > 0 && (
        <p className="text-[11px] text-emerald-300 uppercase tracking-[0.3em]">
          {copy.collect} {copy.chips(formatAmount(winner.payout))}
        </p>
      )}
    </li>
  );
}

function buildWinnerGroups(pot, copy = getHandResultCopy("en")) {
  const groups = [];
  const addGroup = (key, label, winners, tone) => {
    if (Array.isArray(winners) && winners.length > 0) {
      groups.push({ key, label, winners, tone });
    }
  };
  const componentLabel = getComponentLabel(pot, copy);
  if (componentLabel) {
    addGroup("component", componentLabel, pot?.winners, COMPONENT_TONES[pot?.component] ?? "emerald");
  } else {
    addGroup("winners", copy.winners, pot?.winners, "emerald");
  }
  addGroup("high", copy.high, pot?.highWinners, "amber");
  addGroup("low", copy.low, pot?.lowWinners, "cyan");
  addGroup("badugi", copy.badugi, pot?.badugiWinners, "violet");
  return groups;
}

function PotSection({ pot, index, singlePot, language, copy, players, heroSeat }) {
  const winnerGroups = buildWinnerGroups(pot, copy);
  const title = getPotTitle(pot, index, singlePot, copy);
  const componentLabel = getComponentLabel(pot, copy);
  const componentTone = getComponentTone(pot);
  const allSeatsEligible = players.length > 0
    && pot?.eligibleSeatIndexes?.length === players.length
    && new Set(pot.eligibleSeatIndexes).size === players.length
    && pot.eligibleSeatIndexes.every((seatIndex) => Number.isInteger(seatIndex) && seatIndex >= 0 && seatIndex < players.length);
  const eligibleSeatsLabel = allSeatsEligible
    ? (language === "ja" ? "全員" : "All players")
    : getSeatListLabel(pot?.eligibleSeatIndexes, copy, players, heroSeat, language);
  const oddChipLabel = getOddChipLabel(pot, copy);
  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        componentLabel
          ? COMPONENT_SECTION_CLASSES[componentTone] ?? COMPONENT_SECTION_CLASSES.emerald
          : "border-white/10 bg-slate-950/40"
      }`}
      data-testid="hand-result-pot"
      data-component={pot?.component ?? ""}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 uppercase tracking-wide">
        <span data-testid="hand-result-pot-title">{title}</span>
        <span data-testid="hand-result-pot-amount">
          {copy.chips(formatAmount(pot?.potAmount ?? pot?.amount ?? 0))}
        </span>
      </div>
      {(componentLabel || eligibleSeatsLabel || oddChipLabel) && (
        <div
          className={`grid gap-2 rounded-2xl border px-3 py-2 text-[11px] sm:grid-cols-3 ${
            COMPONENT_DETAIL_CLASSES[componentTone] ?? COMPONENT_DETAIL_CLASSES.emerald
          }`}
          data-testid="hand-result-component-detail"
        >
          {componentLabel && (
            <span data-testid="hand-result-component-label">
              <strong className="text-white">{copy.component}:</strong> {componentLabel}
            </span>
          )}
          {eligibleSeatsLabel && (
            <span data-testid="hand-result-eligible-seats">
              <strong className="text-white">{copy.eligible}:</strong> {eligibleSeatsLabel}
            </span>
          )}
          {oddChipLabel && (
            <span className="text-amber-200" data-testid="hand-result-odd-chip">
              {oddChipLabel}
            </span>
          )}
        </div>
      )}
      <div className="space-y-2">
        {winnerGroups.map((group) => (
          <div
            key={group.key}
            data-testid="hand-result-winner-group"
            className="space-y-2 rounded-2xl border border-white/10 bg-black/10 p-2"
          >
            <div
              data-testid="hand-result-winner-group-label"
              className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-300"
            >
              {group.label}
            </div>
            {group.winners.map((winner) => (
              <WinnerCard
                key={`${group.key}-${winner.seatIndex}-${winner.name ?? "winner"}`}
                winner={winner}
                tone={group.tone}
                language={language}
                copy={copy}
              />
            ))}
          </div>
        ))}
        {winnerGroups.length === 0 && (
          <p className="text-xs text-slate-400 italic">{copy.noWinners}</p>
        )}
      </div>
    </div>
  );
}

export default function HandResultOverlay({
  reviewHandId,
  players = [],
  heroSeat = null,
  language = "en",
  visible,
  summary,
  mixedInfo,
  onNext,
  onNextHand,
  buttonLabel,
  nextHandLabel,
  onReplayTarget,
  onHistory,
  onCashOut,
}) {
  if (!visible || !summary) return null;
  const copy = getHandResultCopy(language);
  const resolveWinner = winner => ({ ...winner, name: Number.isInteger(heroSeat) && winner.seatIndex === heroSeat ? (language === 'ja' ? 'あなた' : 'You') : winner.name ?? players[winner.seatIndex]?.name });
  const winners = (summary.winners ?? []).map(resolveWinner);
  const potDetails = (summary.potDetails ?? []).map(pot => ({ ...pot, ...Object.fromEntries(['winners', 'highWinners', 'lowWinners', 'badugiWinners'].filter(key => Array.isArray(pot[key])).map(key => [key, pot[key].map(resolveWinner)])) }));
  const followUpSummary = summary.followUpSummary ?? null;
  const topIssue = followUpSummary?.topIssue ?? null;
  const replayTarget = followUpSummary?.replayTarget ?? null;
  const handleNext = typeof onNext === "function" ? onNext : onNextHand;
  const resolvedButtonLabel = buttonLabel ?? nextHandLabel ?? copy.next;
  // Board and Stud controllers expose totalPot; draw controllers expose pot.
  const totalPot = summary.pot ?? summary.totalPot ?? potDetails.reduce(
    (sum, pot) => sum + Number(pot.potAmount ?? pot.amount ?? 0), 0,
  );
  const potSections =
    potDetails.length > 0
      ? potDetails
      : winners.length
      ? [
          {
            potIndex: 0,
            potAmount: totalPot,
            winners,
          },
        ]
      : [];
  const singlePot = potSections.length <= 1;
  const winnerNames = [...new Set(potSections.flatMap(pot => buildWinnerGroups(pot).flatMap(group => group.winners)).map(winner =>
    winner.name ?? (Number.isInteger(winner.seatIndex) ? `${copy.seat}${winner.seatIndex + 1}` : copy.winner),
  ))];
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-4"
      data-testid="hand-result-overlay"
    >
      <div role="dialog" aria-modal="true" aria-label={copy.title} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-3xl border border-emerald-400/40 bg-slate-900 p-3 shadow-2xl sm:p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 text-xs uppercase tracking-[0.15em] text-emerald-300">
          <span>{copy.title}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
          <h2 data-testid="hand-result-total" className="text-2xl font-bold text-white">
            {copy.pot} {copy.chips(formatAmount(totalPot))}
          </h2>
          <span className="text-sm text-slate-400">{copy.prompt}</span>
        </div>
        {winnerNames.length > 0 && <p data-testid="hand-result-winner-summary" className="shrink-0 text-sm font-semibold leading-snug text-emerald-200">{language === 'ja' ? '獲得したプレイヤー' : `Winner${winnerNames.length > 1 ? 's' : ''}`}: {winnerNames.join(' / ')}</p>}
        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain" data-testid="hand-result-details">
        <div className="space-y-4 text-sm text-slate-200">
          {potSections.map((pot, idx) => (
            <PotSection key={`pot-${pot.potIndex ?? idx}-${pot.component ?? "whole"}`} pot={pot} index={idx} singlePot={singlePot} language={language} copy={copy} players={players} heroSeat={heroSeat} />
          ))}
        </div>
        {mixedInfo && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-xs text-slate-100 space-y-1">
            <div className="flex justify-between text-[11px] uppercase tracking-widest">
              <span>{copy.mixed}</span>
              <span className="text-emerald-300">{mixedInfo.profileName}</span>
            </div>
            <div className="flex justify-between">
              <span>{copy.format}</span>
              <strong className="text-sm text-white">{mixedInfo.formatLabel ?? "-"}</strong>
            </div>
            <div className="flex justify-between">
              <span>{copy.current}</span>
              <strong className="text-sm text-white">{mixedInfo.currentLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span>{copy.nextGame}</span>
              <strong className="text-sm text-white">{mixedInfo.nextLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span>{copy.betting}</span>
              <strong className="text-sm text-white">{mixedInfo.bettingLabel ?? "-"}</strong>
            </div>
            {mixedInfo.handsRemainingText && (
              <div className="flex justify-between text-slate-300">
                <span>{copy.remaining}</span>
                <span>{mixedInfo.handsRemainingText}</span>
              </div>
            )}
          </div>
        )}
        {followUpSummary?.issueCount > 0 && topIssue && (
          <div
            className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
            data-testid="hand-result-follow-up"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200">
                  {copy.followUp}
                </p>
                <p className="mt-1 text-sm">
                  {topIssue.type} · {copy.seat}{topIssue.seat ?? "-"} · {topIssue.street ?? "-"}
                </p>
                <p className="mt-1 text-xs text-amber-100/75">{topIssue.detail}</p>
              </div>
              {replayTarget && typeof onReplayTarget === "function" && (
                <button
                  type="button"
                  className="rounded-xl border border-amber-200/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-100 transition hover:bg-amber-200/10"
                  onClick={() => onReplayTarget(replayTarget)}
                  data-testid="hand-result-follow-up-replay"
                >
                  {copy.review}
                </button>
              )}
            </div>
          </div>
        )}
        {(reviewHandId || summary.handId) && <ReviewBookmarkButton language={language} key={reviewHandId ?? summary.handId} handId={reviewHandId ?? summary.handId} />}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:grid-cols-3" data-testid="hand-result-actions">
        {(typeof onHistory === "function" || typeof onCashOut === "function") && (
          <>
            {typeof onHistory === "function" && (
              <button
                type="button"
                onClick={onHistory}
                data-testid="hand-result-history"
                className="rounded-2xl border border-white/20 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                {copy.history}
              </button>
            )}
            {typeof onCashOut === "function" && (
              <button
                type="button"
                onClick={onCashOut}
                data-testid="hand-result-cash-out"
                className="rounded-2xl border border-yellow-300/40 bg-yellow-400/10 py-3 font-semibold text-yellow-100 transition hover:bg-yellow-400 hover:text-slate-950"
              >
                {copy.leave}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={handleNext}
          data-testid="hand-result-next-hand"
          className="col-span-2 min-h-11 rounded-2xl bg-emerald-500 px-3 py-3 text-slate-900 font-semibold hover:bg-emerald-400 transition sm:col-span-1"
        >
          {resolvedButtonLabel}
        </button>
        </div>
      </div>
    </div>
  );
}
