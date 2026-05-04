import React from "react";

function formatAmount(value) {
  if (value == null) return "0";
  if (typeof value.toLocaleString === "function") {
    return value.toLocaleString("ja-JP");
  }
  return `${value}`;
}

function WinnerCard({ winner, tone = "emerald" }) {
  const cards = Array.isArray(winner.hand) ? winner.hand : [];
  const activeCards = Array.isArray(winner.activeCards) ? winner.activeCards : cards;
  const deadCards = Array.isArray(winner.deadCards) ? winner.deadCards : [];
  const winnerName =
    winner.name ??
    (Number.isInteger(winner.seatIndex) ? `Seat ${winner.seatIndex + 1}` : "Winner");
  const handLabel = winner.handLabel ?? winner.evaluation?.handName ?? "Winner";
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
          Dead: {deadCards.join(" ")}
        </div>
      )}
      {cards.length > 0 && activeCards.length === 0 && (
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

function buildWinnerGroups(pot) {
  const groups = [];
  const addGroup = (key, label, winners, tone) => {
    if (Array.isArray(winners) && winners.length > 0) {
      groups.push({ key, label, winners, tone });
    }
  };
  addGroup("winners", "Winners", pot?.winners, "emerald");
  addGroup("high", "High", pot?.highWinners, "amber");
  addGroup("low", "Low", pot?.lowWinners, "cyan");
  addGroup("badugi", "Badugi", pot?.badugiWinners, "violet");
  return groups;
}

function PotSection({ pot, index, singlePot }) {
  const winnerGroups = buildWinnerGroups(pot);
  const title =
    singlePot || index === 0
      ? singlePot
        ? "Pot"
        : "Main Pot"
      : index === 1
      ? "Side Pot"
      : `Side Pot ${index}`;
  return (
    <div
      className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3"
      data-testid="hand-result-pot"
    >
      <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-[0.4em]">
        <span data-testid="hand-result-pot-title">{title}</span>
        <span data-testid="hand-result-pot-amount">
          ¥{formatAmount(pot?.potAmount ?? pot?.amount ?? 0)}
        </span>
      </div>
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
              />
            ))}
          </div>
        ))}
        {winnerGroups.length === 0 && (
          <p className="text-xs text-slate-400 italic">No eligible winners</p>
        )}
      </div>
    </div>
  );
}

export default function HandResultOverlay({
  visible,
  summary,
  mixedInfo,
  onNext,
  onNextHand,
  buttonLabel,
  nextHandLabel,
  onReplayTarget,
}) {
  if (!visible || !summary) return null;
  const winners = summary.winners ?? [];
  const potDetails = summary.potDetails ?? [];
  const followUpSummary = summary.followUpSummary ?? null;
  const topIssue = followUpSummary?.topIssue ?? null;
  const replayTarget = followUpSummary?.replayTarget ?? null;
  const handleNext = typeof onNext === "function" ? onNext : onNextHand;
  const resolvedButtonLabel = buttonLabel ?? nextHandLabel ?? "Next hand";
  const potSections =
    potDetails.length > 0
      ? potDetails
      : winners.length
      ? [
          {
            potIndex: 0,
            potAmount: summary.pot ?? 0,
            winners,
          },
        ]
      : [];
  const singlePot = potSections.length <= 1;
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
        <div className="space-y-4 text-sm text-slate-200">
          {potSections.map((pot, idx) => (
            <PotSection key={`pot-${pot.potIndex ?? idx}`} pot={pot} index={idx} singlePot={singlePot} />
          ))}
        </div>
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
        {followUpSummary?.issueCount > 0 && topIssue && (
          <div
            className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
            data-testid="hand-result-follow-up"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200">
                  Follow-up
                </p>
                <p className="mt-1 text-sm">
                  {topIssue.type} · Seat {topIssue.seat ?? "-"} · {topIssue.street ?? "-"}
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
                  Review
                </button>
              )}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-2xl bg-emerald-500 py-3 text-slate-900 font-semibold hover:bg-emerald-400 transition"
        >
          {resolvedButtonLabel}
        </button>
      </div>
    </div>
  );
}
