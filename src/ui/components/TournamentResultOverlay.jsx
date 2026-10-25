import React, { useEffect, useMemo, useRef } from "react";
import CoachingPreviewCard from "./CoachingPreviewCard.jsx";
import CoachingSummaryPanel from "./CoachingSummaryPanel.jsx";
import { buildReplayReviewContract } from "../feedback/replayReviewContract.js";
import { getTournamentReasonLabel } from "../feedback/tournamentReviewContract.js";
import { displayTournamentTitle, getTournamentResultCopy } from "./tournamentResultCopy.js";

const TOURNAMENT_REVIEW_STATUS_COPY = {
  summary: {
    label: "簡易レビュー",
    body: "この大会結果とハンド履歴から、重要局面を振り返れます。",
  },
  loading: {
    label: "レビュー作成中",
    body: "トーナメント履歴を整理しています。",
  },
  complete: {
    label: "レビュー完了",
    body: "ハンド履歴で確認できた内容をまとめました。",
  },
  insufficient_logs: {
    label: "簡易レビューのみ",
    body: "ハンド履歴が少ないため簡易レビューのみ表示しています。",
  },
  unauthenticated: {
    label: "保存なし",
    body: "ログインすると詳細AIレビューを保存できます。",
  },
  error: {
    label: "ローカルレビュー",
    body: "AIレビューを取得できなかったため、端末内の履歴から振り返ります。",
  },
};

const TOURNAMENT_REVIEW_STATUS_COPY_EN = {
  summary: { label: "Quick review", body: "Review the result and key moments from saved hands." },
  loading: { label: "Preparing review", body: "Your tournament result is ready while the review loads." },
  complete: { label: "Review ready", body: "Only findings supported by saved hands are shown." },
  insufficient_logs: { label: "Quick review only", body: "There are too few saved hands for a detailed review." },
  unauthenticated: { label: "Not saved", body: "Sign in to save a detailed AI review." },
  error: { label: "Local review", body: "The AI review could not be loaded. Your saved-hand review is still available." },
};

function formatReviewNumber(value, fallback = "--") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toLocaleString("en-US");
}

function getReviewStatus(review, totalHands) {
  const state = review?.feedbackStatus?.state;
  if (state && TOURNAMENT_REVIEW_STATUS_COPY[state]) return state;
  return totalHands > 0 ? "summary" : "insufficient_logs";
}

function getVariantLabel(review, language) {
  const variants = Array.isArray(review?.variantIds)
    ? review.variantIds.filter(Boolean)
    : [];
  if (variants.length > 1) return `${language === "ja" ? "ミックス" : "Mixed"} (${variants.join(" / ")})`;
  return variants[0] ?? review?.variantId ?? (language === "ja" ? "不明" : "Unknown");
}

function normalizeReviewItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) =>
    typeof item === "string"
      ? { text: item, evidence: [], caveat: null }
      : {
          text: item?.text ?? "",
          evidence: Array.isArray(item?.evidence) ? item.evidence : [],
          caveat: item?.caveat ?? null,
        },
  ).filter((item) => item.text);
}

function formatEvidence(entry = {}, language) {
  const handId = entry.handId ?? "--";
  const range = entry.actionSeqRange;
  const handLabel = language === "ja" ? "ハンド" : "Hand";
  if (!range?.start) return `${handLabel} ${handId}`;
  const seq = range.end && range.end !== range.start
    ? `${range.start}-${range.end}`
    : range.start;
  return `${handLabel} ${handId} · ${language === "ja" ? "アクション" : "action"} ${seq}`;
}

function ReviewItemList({ items, emptyText, language }) {
  if (!items.length) {
    return <p className="mt-1 text-xs text-slate-400">{emptyText}</p>;
  }
  return (
    <ul className="mt-1 space-y-2 text-xs text-slate-200">
      {items.map((item, index) => (
        <li key={`${item.text}:${index}`}>
          <p>{item.text}</p>
          {item.evidence.length ? (
            <p className="mt-0.5 text-[10px] text-sky-200">
              {language === "en" ? "Evidence" : "根拠"}: {item.evidence.map((entry) => formatEvidence(entry, language)).join(" / ")}
            </p>
          ) : null}
          {item.caveat ? (
            <p className="mt-0.5 text-[10px] text-slate-400">{language === "en" ? "Note" : "注記"}: {item.caveat}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function buildReviewView(review, language) {
  const result = review?.result ?? {};
  const totalHands =
    review?.dataQuality?.totalHands ??
    review?.feedbackStatus?.totalHands ??
    review?.feedbackStatus?.handCount ??
    review?.hands?.length ??
    0;
  const status = getReviewStatus(review, totalHands);
  const keyHands = Array.isArray(review?.keyHands) ? review.keyHands.slice(0, 3) : [];
  const improvementItems = Array.isArray(review?.nextImprovements?.items)
    ? review.nextImprovements.items.slice(0, 2)
    : [];
  const summary = review?.reviewSummary ?? {};
  const facts = normalizeReviewItems(summary.facts).slice(0, 4);
  const interpretations = normalizeReviewItems(
    summary.interpretations ?? [
      ...(summary.goodPoints ?? []),
      ...(summary.improvementPoints ?? []),
    ],
  ).slice(0, 4);
  const nextActions = normalizeReviewItems(
    summary.nextActions ?? improvementItems,
  ).slice(0, 3);
  return {
    status,
    statusCopy: (language === "en" ? TOURNAMENT_REVIEW_STATUS_COPY_EN : TOURNAMENT_REVIEW_STATUS_COPY)[status],
    placement: result.placement ?? result.finish ?? null,
    payout: result.payout ?? result.prize ?? null,
    totalHands,
    variantLabel: getVariantLabel(review, language),
    keyHands,
    improvementItems,
    facts,
    interpretations,
    nextActions,
    causalDisclaimer: summary.causalDisclaimer ?? null,
  };
}

export function TournamentReviewSection({
  tournamentReview,
  onOpenReviewReplay,
  language,
}) {
  const view = buildReviewView(tournamentReview, language);
  const showReviewLists = Boolean(tournamentReview);
  return (
    <section
      className="rounded-2xl border border-emerald-300/20 bg-black/25 px-4 py-3 text-sm text-slate-100"
      data-testid="mtt-tournament-review"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
            {language === "ja" ? "大会の振り返り" : "Tournament Review"}
          </p>
          <p className="mt-1 text-xs text-slate-300" data-testid="mtt-tournament-review-status">
            {view.statusCopy.label}: {view.statusCopy.body}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-4">
          <span>
            <b className="block text-slate-400">{language === "ja" ? "順位" : "Place"}</b>
            {view.placement ?? "--"}
          </span>
          <span>
            <b className="block text-slate-400">{language === "ja" ? "賞金" : "Payout"}</b>
            {formatReviewNumber(view.payout, "0")}
          </span>
          <span>
            <b className="block text-slate-400">{language === "ja" ? "ハンド" : "Hands"}</b>
            {formatReviewNumber(view.totalHands, "0")}
          </span>
          <span>
            <b className="block text-slate-400">{language === "ja" ? "種目" : "Variant"}</b>
            {view.variantLabel}
          </span>
        </div>
      </div>
      {view.status === "loading" ? (
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-200">
          {language === "en" ? "Preparing the review. You can still see the result." : "レビュー作成中です。結果表示はこのまま確認できます。"}
        </p>
      ) : null}
      {view.status === "error" ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {language === "en" ? "The AI review could not be loaded. The local review below is still available." : "AIレビューは取得できませんでした。以下のローカルレビューは引き続き利用できます。"}
        </p>
      ) : null}
      {view.status === "insufficient_logs" ? (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {language === "en" ? "There are too few saved hands for a detailed review, so this review focuses on the result and payouts." : "ハンド履歴が少ないため、今回は順位・賞金・大会結果中心の簡易レビューです。"}
        </p>
      ) : null}
      {view.status === "unauthenticated" ? (
        <p className="mt-3 rounded-xl bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
          {language === "en" ? "Sign in to save a detailed AI review. A quick review is shown for this tournament." : "ログインすると詳細AIレビューを保存できます。現在はこの大会の簡易レビューを表示しています。"}
        </p>
      ) : null}
      {showReviewLists ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                {language === "en" ? "Recorded facts" : "確認できた事実"}
              </p>
              <ReviewItemList
                items={view.facts}
                emptyText={language === "en" ? "No facts can be confirmed from the saved hands yet." : "記録から確認できる事実はまだありません。"}
                language={language}
              />
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                {language === "en" ? "Interpretation" : "解釈"}
              </p>
              <ReviewItemList
                items={view.interpretations}
                emptyText={language === "en" ? "The result alone cannot show whether a decision was good." : "結果だけから判断の良否は解釈しません。"}
                language={language}
              />
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                {language === "en" ? "Next step" : "次の一手"}
              </p>
              <ReviewItemList
                items={view.nextActions}
                emptyText={language === "en" ? "Play another tournament with your decisions saved." : "次回は自分の操作を記録してプレイしてください。"}
                language={language}
              />
            </div>
          </div>
          {view.causalDisclaimer ? (
            <p className="rounded-xl border border-slate-500/20 bg-slate-950/40 px-3 py-2 text-[10px] text-slate-400">
              {view.causalDisclaimer}
            </p>
          ) : null}
          <div className="rounded-xl bg-white/5 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
              {language === "ja" ? "注目ハンド" : "Key Hands"}
            </p>
            {view.keyHands.length ? (
              <ul className="mt-1 space-y-1 text-xs text-slate-200">
                {view.keyHands.map((hand) => (
                  <li
                    key={hand.keyHandId ?? `${hand.reason}:${hand.handId}`}
                    className="space-y-1"
                    data-testid="mtt-tournament-review-key-hand"
                  >
                    <div>
                      <span className="font-semibold text-slate-100">
                        {hand.title ?? hand.label ?? (language === "ja" ? "注目ハンド" : "Key hand")}
                      </span>
                      <span className="text-slate-400">: {hand.handId}</span>
                    </div>
                    {hand.description ? (
                      <p className="text-[11px] text-slate-300">{hand.description}</p>
                    ) : null}
                    {Array.isArray(hand.reasonTags) && hand.reasonTags.length ? (
                      <p className="text-[10px] text-sky-200">
                        {language === "ja" ? "注目点" : "Highlights"}: {hand.reasonTags.map((reason) => getTournamentReasonLabel(reason, language)).join(" / ")}
                      </p>
                    ) : null}
                    {Array.isArray(hand.evidence) && hand.evidence.length ? (
                      <p className="text-[10px] text-slate-400">
                        {language === "en" ? "Evidence" : "根拠"}: {hand.evidence.map((entry) => formatEvidence(entry, language)).join(" / ")}
                      </p>
                    ) : null}
                    {typeof onOpenReviewReplay === "function" && hand.replayRef?.target ? (
                      <button
                        type="button"
                        className="rounded-full border border-sky-300/30 px-2 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-300/10"
                        onClick={() =>
                          onOpenReviewReplay({
                            ...hand.replayRef.target,
                            replayReview: buildReplayReviewContract({
                              reviewMode: "tournament",
                              keyHand: hand,
                              replayRef: hand.replayRef,
                              variantId: hand.variantId,
                            }),
                          })
                        }
                        data-testid="mtt-tournament-review-replay"
                      >
                        {language === "ja" ? "リプレイ" : "Replay"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{language === "en" ? "No key hands have been identified yet." : "重要ハンドはまだ抽出されていません。"}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function TournamentResultOverlay({
  visible,
  placements = [],
  title,
  language,
  tournamentReview = null,
  onOpenReviewReplay,
  coachingPreview = null,
  coachingLocale = language === "en" ? "en" : "jp",
  onCoachingReplay,
  onCoachingTelemetry,
  onBackToMenu,
  onEnterNewTournament,
}) {
  const shownKeyRef = useRef(null);
  const visibleLessons = useMemo(
    () => coachingPreview?.summary?.topLessons ?? coachingPreview?.lessons?.slice(0, 2) ?? [],
    [coachingPreview],
  );
  const useSummaryPanel = Boolean(coachingPreview?.summary);
  useEffect(() => {
    if (!visible || !visibleLessons.length || typeof onCoachingTelemetry !== "function") return;
    const key = visibleLessons.map((lesson) => lesson.lessonId).join("|");
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;
    visibleLessons.forEach((lesson) => {
      onCoachingTelemetry("LESSON_SHOWN", lesson);
    });
  }, [visible, visibleLessons, onCoachingTelemetry]);
  if (!visible) return null;
  const copy = getTournamentResultCopy(language);
  const displayTitle = displayTournamentTitle(title, language, copy.tournamentResults);
  const sortedPlacements = [...placements].sort((a, b) => a.place - b.place);
  const champion = sortedPlacements.find((entry) => entry.place === 1) ?? null;
  const showPayoutColumn = sortedPlacements.length > 0;
  const championPrize =
    typeof champion?.payout === "number" ? champion.payout : 0;
  const championStack =
    typeof champion?.stack === "number" ? champion.stack : null;
  const championKnockouts =
    typeof champion?.knockouts === "number" ? champion.knockouts : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900 text-white shadow-2xl"
        data-testid="mtt-result-overlay"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6" data-testid="mtt-result-scroll-content">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            {copy.tournamentComplete}
          </p>
          {champion ? (
            <div
              className="rounded-2xl border border-yellow-300/35 bg-yellow-300/10 px-4 py-4"
              data-testid="mtt-champion-celebration"
            >
              <p className="text-3xl font-black uppercase tracking-[0.16em] text-yellow-200">
                🏆 {copy.champion}
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase text-white">
                {displayTitle.toUpperCase()}
              </h2>
              <p className="mt-1 text-lg font-black text-emerald-200">
                {copy.firstPlace}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">{copy.prize}</p>
                  <p className="font-black text-yellow-200">{championPrize}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">{copy.entrants}</p>
                  <p className="font-black text-white">{sortedPlacements.length || "--"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">{copy.finalStack}</p>
                  <p className="font-black text-white">{championStack ?? "--"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">{copy.knockouts}</p>
                  <p className="font-black text-white">{championKnockouts ?? "--"}</p>
                </div>
              </div>
            </div>
          ) : (
            <h2 className="text-3xl font-bold">{displayTitle}</h2>
          )}
          {champion ? (
            <p className="text-sm text-emerald-200" data-testid="mtt-result-champion">
              {copy.championPrefix} <strong>{champion.name}</strong>
            </p>
          ) : null}
        </header>
        <div className="max-h-[420px] overflow-y-auto space-y-2">
          {sortedPlacements.map((entry) => (
            <div
              key={entry.id ?? entry.place}
              className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 ${
                entry.place === 1
                  ? "bg-emerald-500/10 border-emerald-400/40"
                  : "bg-white/5"
              }`}
              data-testid="mtt-result-row"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="text-xl font-bold text-emerald-300"
                    data-testid="mtt-result-place"
                  >
                    {entry.place}
                  </span>
                  {entry.place === 1 ? (
                    <span
                      className="text-[10px] uppercase tracking-[0.3em] text-emerald-200"
                      data-testid="mtt-result-champion-badge"
                    >
                      {copy.champion}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-base font-semibold"
                    data-testid="mtt-result-name"
                  >
                    {entry.name}
                  </span>
                  <span
                    className="text-sm text-slate-300"
                    data-testid="mtt-result-stack"
                  >
                    {copy.stack(entry.stack)}
                  </span>
                </div>
              </div>
              {showPayoutColumn ? (
                <div
                  className="text-right text-sm font-semibold text-yellow-300"
                  data-testid="mtt-result-payout"
                >
                  {copy.payoutRow(typeof entry.payout === "number" ? entry.payout : 0)}
                </div>
              ) : null}
            </div>
            ))}
        </div>
        <TournamentReviewSection
          tournamentReview={tournamentReview}
          onOpenReviewReplay={onOpenReviewReplay}
          language={language}
        />
        {useSummaryPanel ? (
          <div className="space-y-2" data-testid="mtt-coaching-preview">
            <CoachingSummaryPanel
              summary={coachingPreview.summary}
              locale={coachingLocale}
              onReplay={(payload) => {
                const lesson = visibleLessons.find((entry) => entry.lessonId === payload.lessonId) ?? payload;
                onCoachingTelemetry?.("REPLAY_OPENED", lesson);
                onCoachingReplay?.(payload);
              }}
              onOpened={(entry) => onCoachingTelemetry?.("LESSON_OPENED", entry)}
              onHelpful={(entry) => onCoachingTelemetry?.("LESSON_HELPFUL", entry)}
              onNotHelpful={(entry) => onCoachingTelemetry?.("LESSON_NOT_HELPFUL", entry)}
            />
          </div>
        ) : coachingPreview?.lessons?.length > 0 ? (
          <div className="space-y-2" data-testid="mtt-coaching-preview">
            {visibleLessons.map((lesson) => (
              <CoachingPreviewCard
                key={lesson.lessonId}
                lesson={lesson}
                locale={coachingLocale}
                onReplay={(payload) => {
                  onCoachingTelemetry?.("REPLAY_OPENED", lesson);
                  onCoachingReplay?.(payload);
                }}
                onOpened={(entry) => onCoachingTelemetry?.("LESSON_OPENED", entry)}
                onAcknowledged={(entry) => onCoachingTelemetry?.("LESSON_ACKNOWLEDGED", entry)}
                onHelpful={(entry) => onCoachingTelemetry?.("LESSON_HELPFUL", entry)}
                onNotHelpful={(entry) => onCoachingTelemetry?.("LESSON_NOT_HELPFUL", entry)}
                onDismissed={(entry) => onCoachingTelemetry?.("LESSON_DISMISSED", entry)}
              />
            ))}
          </div>
        ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="mtt-back-to-menu"
            onClick={onBackToMenu}
            className="min-h-[44px] px-5 py-3 rounded-full bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
          >
            {copy.backToMenu}
          </button>
          {typeof onEnterNewTournament === "function" ? (
            <button
              type="button"
              data-testid="mtt-enter-new-tournament"
              onClick={onEnterNewTournament}
              className="min-h-[44px] px-5 py-3 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition"
            >
              {copy.enterTournament}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
