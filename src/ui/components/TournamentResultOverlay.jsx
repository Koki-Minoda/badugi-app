import React, { useEffect, useMemo, useRef } from "react";
import CoachingPreviewCard from "./CoachingPreviewCard.jsx";
import CoachingSummaryPanel from "./CoachingSummaryPanel.jsx";
import { buildReplayReviewContract } from "../feedback/replayReviewContract.js";

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
    body: "根拠を構造化できた内容のみ採用し、ローカルレビューも保持しています。",
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

function getVariantLabel(review) {
  const variants = Array.isArray(review?.variantIds)
    ? review.variantIds.filter(Boolean)
    : [];
  if (variants.length > 1) return `Mixed (${variants.join(" / ")})`;
  return variants[0] ?? review?.variantId ?? "Unknown";
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

function formatEvidence(entry = {}) {
  const handId = entry.handId ?? "--";
  const range = entry.actionSeqRange;
  if (!range?.start) return `Hand ${handId}`;
  const seq = range.end && range.end !== range.start
    ? `${range.start}-${range.end}`
    : range.start;
  return `Hand ${handId} · action ${seq}`;
}

function ReviewItemList({ items, emptyText }) {
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
              根拠: {item.evidence.map(formatEvidence).join(" / ")}
            </p>
          ) : null}
          {item.caveat ? (
            <p className="mt-0.5 text-[10px] text-slate-400">注記: {item.caveat}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function buildReviewView(review) {
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
    statusCopy: TOURNAMENT_REVIEW_STATUS_COPY[status],
    placement: result.placement ?? result.finish ?? null,
    payout: result.payout ?? result.prize ?? null,
    totalHands,
    variantLabel: getVariantLabel(review),
    keyHands,
    improvementItems,
    facts,
    interpretations,
    nextActions,
    causalDisclaimer: summary.causalDisclaimer ?? null,
  };
}

function TournamentReviewSection({ tournamentReview, onOpenReviewReplay }) {
  const view = buildReviewView(tournamentReview);
  const showReviewLists = Boolean(tournamentReview);
  return (
    <section
      className="rounded-2xl border border-emerald-300/20 bg-black/25 px-4 py-3 text-sm text-slate-100"
      data-testid="mtt-tournament-review"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
            Tournament Review
          </p>
          <p className="mt-1 text-xs text-slate-300" data-testid="mtt-tournament-review-status">
            {view.statusCopy.label}: {view.statusCopy.body}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-4">
          <span>
            <b className="block text-slate-400">Place</b>
            {view.placement ?? "--"}
          </span>
          <span>
            <b className="block text-slate-400">Payout</b>
            {formatReviewNumber(view.payout, "0")}
          </span>
          <span>
            <b className="block text-slate-400">Hands</b>
            {formatReviewNumber(view.totalHands, "0")}
          </span>
          <span>
            <b className="block text-slate-400">Variant</b>
            {view.variantLabel}
          </span>
        </div>
      </div>
      {view.status === "loading" ? (
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-200">
          レビュー作成中です。結果表示はこのまま確認できます。
        </p>
      ) : null}
      {view.status === "error" ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100">
          AIレビューは取得できませんでした。以下のローカルレビューは引き続き利用できます。
        </p>
      ) : null}
      {view.status === "insufficient_logs" ? (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          ハンド履歴が少ないため、今回は順位・賞金・大会結果中心の簡易レビューです。
        </p>
      ) : null}
      {view.status === "unauthenticated" ? (
        <p className="mt-3 rounded-xl bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
          ログインすると詳細AIレビューを保存できます。現在はこの大会の簡易レビューを表示しています。
        </p>
      ) : null}
      {showReviewLists ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                確認できた事実
              </p>
              <ReviewItemList
                items={view.facts}
                emptyText="記録から確認できる事実はまだありません。"
              />
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                解釈
              </p>
              <ReviewItemList
                items={view.interpretations}
                emptyText="結果だけから判断の良否は解釈しません。"
              />
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                次の一手
              </p>
              <ReviewItemList
                items={view.nextActions}
                emptyText="次回はHero actionが残る状態でプレイしてください。"
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
              Key Hands
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
                        {hand.title ?? hand.label ?? "Key hand"}
                      </span>
                      <span className="text-slate-400">: {hand.handId}</span>
                    </div>
                    {hand.description ? (
                      <p className="text-[11px] text-slate-300">{hand.description}</p>
                    ) : null}
                    {Array.isArray(hand.reasonTags) && hand.reasonTags.length ? (
                      <p className="text-[10px] text-sky-200">
                        Tags: {hand.reasonTags.join(" / ")}
                      </p>
                    ) : null}
                    {Array.isArray(hand.evidence) && hand.evidence.length ? (
                      <p className="text-[10px] text-slate-400">
                        根拠: {hand.evidence.map(formatEvidence).join(" / ")}
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
                        Replay
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-400">重要ハンドはまだ抽出されていません。</p>
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
  title = "Tournament Results",
  tournamentReview = null,
  onOpenReviewReplay,
  coachingPreview = null,
  coachingLocale = "jp",
  onCoachingReplay,
  onCoachingTelemetry,
  onBackToMenu,
  onPlayAgain,
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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-emerald-500/20 bg-slate-900 p-4 text-white shadow-2xl sm:space-y-6 sm:p-8"
        data-testid="mtt-result-overlay"
      >
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Tournament Complete
          </p>
          {champion ? (
            <div
              className="rounded-2xl border border-yellow-300/35 bg-yellow-300/10 px-4 py-4"
              data-testid="mtt-champion-celebration"
            >
              <p className="text-3xl font-black uppercase tracking-[0.16em] text-yellow-200">
                🏆 Champion
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase text-white">
                {String(title).toUpperCase()}
              </h2>
              <p className="mt-1 text-lg font-black text-emerald-200">
                1st Place
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">Prize</p>
                  <p className="font-black text-yellow-200">{championPrize}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">Entrants</p>
                  <p className="font-black text-white">{sortedPlacements.length || "--"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">Final Stack</p>
                  <p className="font-black text-white">{championStack ?? "--"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                  <p className="uppercase tracking-wide text-slate-400">Knockouts</p>
                  <p className="font-black text-white">{championKnockouts ?? "--"}</p>
                </div>
              </div>
            </div>
          ) : (
            <h2 className="text-3xl font-bold">{title}</h2>
          )}
          {champion ? (
            <p className="text-sm text-emerald-200" data-testid="mtt-result-champion">
              Champion: <strong>{champion.name}</strong>
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
                      Champion
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
                    Stack: {entry.stack}
                  </span>
                </div>
              </div>
              {showPayoutColumn ? (
                <div
                  className="text-right text-sm font-semibold text-yellow-300"
                  data-testid="mtt-result-payout"
                >
                  {typeof entry.payout === "number" ? `Payout ${entry.payout}` : "Payout 0"}
                </div>
              ) : null}
            </div>
            ))}
        </div>
        <TournamentReviewSection
          tournamentReview={tournamentReview}
          onOpenReviewReplay={onOpenReviewReplay}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-5 py-3 rounded-full bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
          >
            Back to Menu
          </button>
          {typeof onPlayAgain === "function" ? (
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-5 py-3 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition"
            >
              Play Again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
