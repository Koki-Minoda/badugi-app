import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentHandHistorySnapshot,
  getHandHistoryBufferSnapshot,
} from "../state/handHistoryStore.js";
import { buildPlayFeedbackPayload, MIN_FEEDBACK_HANDS } from "../feedback/playFeedbackPayload.js";
import { hasStoredFeedbackAuth, requestPlayFeedback } from "../feedback/playFeedbackApi.js";
import {
  getLatestPlayFeedbackResult,
  savePlayFeedbackResult,
} from "../feedback/playFeedbackStore.js";

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

export default function HandHistoryScreen({
  onClose = () => {},
  onReplay = () => {},
  language = "ja",
  embedded = false,
}) {
  const [filterMode, setFilterMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveHandSnapshot, setLiveHandSnapshot] = useState(null);
  const [completedSnapshotList, setCompletedSnapshotList] = useState([]);
  const [feedbackState, setFeedbackState] = useState({
    loading: false,
    error: null,
    response: null,
  });

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
  const feedbackPayloadResult = useMemo(
    () =>
      buildPlayFeedbackPayload({
        hands: completedSnapshotList,
        mode: "cash",
        variantScope: "mixed",
      }),
    [completedSnapshotList],
  );
  const savedFeedback = useMemo(
    () => getLatestPlayFeedbackResult(feedbackPayloadResult.payload),
    [feedbackPayloadResult.payload],
  );
  const isJapanese = language === "ja";
  const copy = isJapanese
    ? {
        title: "ハンド履歴",
        description:
          "現在進行中のハンドと直近の完了ハンドを確認できます。行を選ぶとリプレイを開きます。",
        refresh: "更新",
        back: "ゲーム選択へ戻る",
        search: "検索",
        searchPlaceholder: "handId を検索…",
        filter: "絞り込み",
        all: "すべて",
        live: "進行中",
        completed: "完了",
        noHands: "まだハンドが記録されていません。1ハンドプレイしてから戻ると表示されます。",
        noMatches: "検索条件に一致するハンドはありません。",
        feedbackTitle: "プレイフィードバック",
        feedbackBody:
          "30ハンド以上の履歴から、良かった点、悪かった点、次回方針をAIフィードバックとして保存します。",
        feedbackButton: "AIフィードバック作成",
        feedbackLoading: "解析中...",
        feedbackLogin: "ログインするとAIフィードバックを送信できます。",
        feedbackNotReady: `${MIN_FEEDBACK_HANDS}ハンド以上プレイすると利用できます。`,
        feedbackSource: "保存元",
        savedFeedback: "保存済みフィードバック",
        keyHandsTitle: "該当ハンド",
        keyHandsBody: "AIの指摘と実際のアクションを結び付けるため、重要局面を表示します。",
        replayHand: "リプレイ",
      }
    : {
        title: "Hand History",
        description:
          "Review the live hand plus recently completed hands. Tap any row to open the replay.",
        refresh: "Refresh",
        back: "Back",
        search: "Search",
        searchPlaceholder: "Search handId…",
        filter: "Filter",
        all: "All",
        live: "LIVE",
        completed: "Completed",
        noHands: "No hands recorded yet. Play a hand and return to see the history.",
        noMatches: "No hands match your search/filter.",
        feedbackTitle: "Play Feedback",
        feedbackBody:
          "Use 30+ completed hands to save AI feedback with strengths, leaks, and next-session goals.",
        feedbackButton: "Create AI Feedback",
        feedbackLoading: "Analyzing...",
        feedbackLogin: "Log in to request AI feedback.",
        feedbackNotReady: `Play at least ${MIN_FEEDBACK_HANDS} hands to enable feedback.`,
        feedbackSource: "Source",
        savedFeedback: "Saved feedback",
        keyHandsTitle: "Referenced Hands",
        keyHandsBody: "Key spots are linked to the exact hand/action range used for feedback.",
        replayHand: "Replay",
      };
  const activeFeedbackEntry = feedbackState.response
    ? { response: feedbackState.response, keyHands: feedbackPayloadResult.payload?.keyHands ?? [] }
    : savedFeedback;
  const feedbackKeyHands = Array.isArray(activeFeedbackEntry?.keyHands)
    ? activeFeedbackEntry.keyHands.slice(0, 6)
    : [];

  async function handleRequestFeedback() {
    if (!feedbackPayloadResult.eligible || !feedbackPayloadResult.payload) return;
    setFeedbackState({ loading: true, error: null, response: null });
    try {
      const response = await requestPlayFeedback(feedbackPayloadResult.payload);
      savePlayFeedbackResult({ payload: feedbackPayloadResult.payload, response });
      setFeedbackState({ loading: false, error: null, response });
    } catch (error) {
      setFeedbackState({
        loading: false,
        error: error instanceof Error ? error.message : "feedback_failed",
        response: null,
      });
    }
  }

  return (
    <div className={`${embedded ? "bg-transparent" : "min-h-screen bg-slate-950"} px-4 py-6 text-slate-100`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">MGX</p>
            <h1 className="text-2xl font-semibold text-white">{copy.title}</h1>
            <p className="text-sm text-slate-300/80">
              {copy.description}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={refreshSnapshots}
            >
              {copy.refresh}
            </button>
            <button
              type="button"
              className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={onClose}
            >
              {copy.back}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-white/60">{copy.search}</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/60">{copy.filter}</p>
            <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              {[
                { label: copy.all, value: "all" },
                { label: copy.live, value: "live" },
                { label: copy.completed, value: "completed" },
              ].map((option) => (
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

        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-4 text-sm text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">{copy.feedbackTitle}</h2>
              <p className="mt-1 text-slate-300/80">{copy.feedbackBody}</p>
              <p className="mt-2 text-xs text-slate-400">
                Hands: {feedbackPayloadResult.handCount} / Minimum: {MIN_FEEDBACK_HANDS}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestFeedback}
              disabled={
                feedbackState.loading ||
                !feedbackPayloadResult.eligible ||
                !hasStoredFeedbackAuth()
              }
              className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {feedbackState.loading ? copy.feedbackLoading : copy.feedbackButton}
            </button>
          </div>
          {!hasStoredFeedbackAuth() && (
            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-100">
              {copy.feedbackLogin}
            </p>
          )}
          {!feedbackPayloadResult.eligible && (
            <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-slate-300">
              {copy.feedbackNotReady}
            </p>
          )}
          {feedbackState.error && (
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">
              {feedbackState.error}
            </p>
          )}
          {(feedbackState.response || savedFeedback?.response) && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-emerald-300">
                {feedbackState.response
                  ? `${copy.feedbackSource}: ${feedbackState.response.source ?? "-"}`
                  : copy.savedFeedback}
              </p>
              <p className="whitespace-pre-wrap">
                {(feedbackState.response ?? savedFeedback.response).adviceJa}
              </p>
              {feedbackKeyHands.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
                    {copy.keyHandsTitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{copy.keyHandsBody}</p>
                  <div className="mt-3 grid gap-2">
                    {feedbackKeyHands.map((spot) => {
                      const matched = rows.find((entry) => entry.hand?.handId === spot.handId);
                      const actionRange = spot.actionSeqRange
                        ? `#${spot.actionSeqRange.start}-${spot.actionSeqRange.end}`
                        : "-";
                      return (
                        <div
                          key={`${spot.situationId}-${spot.handId}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {spot.situationId} / {spot.handId ?? "-"}
                            </p>
                            <p className="text-slate-400">
                              {spot.reason ?? "-"} · {spot.street ?? "-"} · {spot.heroAction ?? "-"} · action {actionRange}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!matched}
                            onClick={() => matched && onReplay?.(matched.hand)}
                            className="rounded-full border border-emerald-300/40 px-3 py-1 text-[11px] font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                          >
                            {copy.replayHand}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="space-y-4">
          {filteredRows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
              {rows.length === 0
                ? copy.noHands
                : copy.noMatches}
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
