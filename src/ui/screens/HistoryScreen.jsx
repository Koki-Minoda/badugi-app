import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { getHands, getTournaments, getTournamentHands } from "../../utils/history.js";
import { getVariantProfile } from "../../games/config/variantProfiles.js";
import {
  buildPlayFeedbackPayload,
  createFeedbackScopeOptions,
  MIN_FEEDBACK_HANDS,
} from "../feedback/playFeedbackPayload.js";
import { hasStoredFeedbackAuth, requestPlayFeedback } from "../feedback/playFeedbackApi.js";
import {
  getLatestPlayFeedbackResult,
  savePlayFeedbackResult,
} from "../feedback/playFeedbackStore.js";
import { buildReplayReviewContract } from "../feedback/replayReviewContract.js";
import ReplayScreen from "./ReplayScreen.jsx";

const fmt = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function getCashHandEnd(hand) {
  return Array.isArray(hand?.events)
    ? [...hand.events].reverse().find((event) => event?.type === "HAND_END")
    : null;
}

function getCashWinnersLabel(hand) {
  const handEnd = getCashHandEnd(hand);
  if (handEnd?.winners?.length) {
    return handEnd.winners
      .map((winner) => `Seat ${winner.seat} +${winner.amount}`)
      .join(", ");
  }
  if (Array.isArray(hand?.winners) && hand.winners.length > 0) {
    return hand.winners.join(", ");
  }
  return "-";
}

function getTotalPotLabel(hand) {
  const handEnd = getCashHandEnd(hand);
  return handEnd?.totalPot ?? hand?.pot ?? hand?.uiSummary?.pot ?? "-";
}

function getActionCount(hand) {
  if (Array.isArray(hand?.events)) {
    return hand.events.filter((event) => event?.type === "ACTION").length;
  }
  return hand?.legacyRecord?.seats?.reduce(
    (sum, seat) => sum + (Array.isArray(seat.actions) ? seat.actions.length : 0),
    0,
  ) ?? 0;
}

function getPlayerRows(hand) {
  const rows = Array.isArray(hand?.seats) ? hand.seats : hand?.legacyRecord?.seats;
  return Array.isArray(rows) ? rows : [];
}

function getVariantLabel(hand) {
  if (hand?.variantName) return hand.variantName;
  const variantId = hand?.variantId ?? hand?.gameId ?? hand?.metadata?.variantId;
  if (!variantId) return "Badugi";
  if (String(variantId).toLowerCase() === "badugi") return "Badugi";
  return getVariantProfile(variantId)?.name ?? String(variantId);
}

function getEvaluatorLabel(hand) {
  const direct = hand?.evaluatorLabel ?? hand?.evaluator ?? hand?.metadata?.evaluator;
  if (direct) return direct;
  const profile = getVariantProfile(hand?.variantId ?? hand?.gameId ?? hand?.metadata?.variantId);
  return Array.isArray(profile?.evaluators) && profile.evaluators.length > 0
    ? profile.evaluators.join(" / ")
    : "-";
}

function formatEvent(event) {
  if (!event?.type) return "Unknown event";
  if (event.type === "ACTION") {
    const label = event.action ?? event.actionType ?? event.decision ?? event.type;
    const amount = event.amount ?? event.bet ?? event.toCall;
    return `Seat ${event.seat ?? "-"} ${label}${amount != null ? ` ${amount}` : ""}`;
  }
  if (event.type === "PHASE_TRANSITION") {
    return `${event.from ?? "-"} -> ${event.to ?? "-"}`;
  }
  if (event.type === "HAND_END") {
    return `Hand end: pot ${event.totalPot ?? "-"}, winners ${getCashWinnersLabel({ events: [event] })}`;
  }
  return event.type;
}

function getPotWinnersLabel(pot = {}) {
  const winners = Array.isArray(pot.winners)
    ? pot.winners
    : Array.isArray(pot.payouts)
      ? pot.payouts
      : [];
  if (!winners.length) return null;
  return winners
    .map((winner) => {
      const seat = winner.seat ?? winner.seatIndex ?? winner.playerSeat ?? "-";
      const amount = winner.amount ?? winner.payout ?? winner.chips ?? winner.value ?? 0;
      const label = winner.name ?? winner.playerName ?? `Seat ${seat}`;
      return `${label} +${amount}`;
    })
    .join(", ");
}

function getFeedbackKeyHands(entry) {
  if (Array.isArray(entry?.keyHands)) return entry.keyHands;
  if (Array.isArray(entry?.payload?.keyHands)) return entry.payload.keyHands;
  if (Array.isArray(entry?.response?.keyHands)) return entry.response.keyHands;
  return [];
}

export default function HistoryScreen() {
  const navigate = useNavigate();
  const cashHands = useMemo(() => getHands({ limit: 100 }), []);
  const tournaments = useMemo(() => getTournaments({ limit: 200 }), []);
  const [selectedId, setSelectedId] = useState(tournaments[0]?.tournamentId ?? null);
  const [search, setSearch] = useState("");
  const [feedbackState, setFeedbackState] = useState({
    loading: false,
    error: null,
    response: null,
  });
  const [feedbackScope, setFeedbackScope] = useState("mixed");
  const [activeFeedbackReplay, setActiveFeedbackReplay] = useState(null);
  const filtered = tournaments.filter((entry) => {
    if (!search.trim()) return true;
    return (
      entry.tournamentId?.toLowerCase().includes(search.toLowerCase()) ||
      entry.tier?.toLowerCase().includes(search.toLowerCase())
    );
  });
  const hands = useMemo(
    () => (selectedId ? getTournamentHands({ tournamentId: selectedId, limit: 50 }) : []),
    [selectedId]
  );
  const selectedTournament = useMemo(
    () => tournaments.find((entry) => entry.tournamentId === selectedId) ?? null,
    [selectedId, tournaments],
  );
  const feedbackSourceHands = selectedId ? hands : cashHands;
  const feedbackScopeOptions = useMemo(
    () =>
      createFeedbackScopeOptions(feedbackSourceHands, {
        mode: selectedId ? "tournament" : "cash",
        tournamentId: selectedId,
      }),
    [feedbackSourceHands, selectedId],
  );
  const selectedFeedbackScope = feedbackScopeOptions.some((option) => option.value === feedbackScope)
    ? feedbackScope
    : feedbackScopeOptions[0]?.value ?? "mixed";
  const feedbackPayloadResult = useMemo(() => {
    return buildPlayFeedbackPayload({
      hands: feedbackSourceHands,
      mode: selectedId ? "tournament" : "cash",
      variantScope: selectedFeedbackScope,
      tournament: selectedTournament,
    });
  }, [feedbackSourceHands, selectedFeedbackScope, selectedId, selectedTournament]);
  const savedFeedback = useMemo(
    () => getLatestPlayFeedbackResult(feedbackPayloadResult.payload),
    [feedbackPayloadResult.payload],
  );
  const activeFeedbackEntry = feedbackState.response
    ? { response: feedbackState.response, keyHands: feedbackPayloadResult.payload?.keyHands ?? [] }
    : savedFeedback;
  const feedbackKeyHands = getFeedbackKeyHands(activeFeedbackEntry).slice(0, 6);

  function findFeedbackHand(handId) {
    if (!handId) return null;
    return feedbackSourceHands.find((hand) => (hand?.handId ?? hand?.id) === handId) ?? null;
  }

  function buildFeedbackReplayTarget(spot = {}) {
    const hand = findFeedbackHand(spot.handId);
    if (!hand) return null;
    const target = spot.replayTarget ?? {
      handId: spot.handId,
      actionSeqStart: spot.actionSeqRange?.start ?? null,
      actionSeqEnd: spot.actionSeqRange?.end ?? null,
      seat: spot.seatIndex ?? spot.seat ?? null,
      street: spot.street ?? null,
      type: spot.heroAction ?? null,
    };
    const replayRef = {
      handId: spot.handId,
      variantId: spot.variantId ?? hand.variantId ?? hand.gameId ?? null,
      target,
      available: true,
    };
    return {
      handId: spot.handId,
      hand,
      target: {
        ...target,
        replayReview: buildReplayReviewContract({
          reviewMode: "cash",
          keyHand: spot,
          replayRef,
          variantId: spot.variantId ?? hand.variantId ?? hand.gameId,
        }),
      },
    };
  }

  function handleOpenFeedbackReplay(spot) {
    const replay = buildFeedbackReplayTarget(spot);
    if (!replay) return;
    setActiveFeedbackReplay(replay);
  }

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

  if (activeFeedbackReplay) {
    return (
      <ReplayScreen
        handId={activeFeedbackReplay.handId}
        target={activeFeedbackReplay.target}
        initialHandSnapshot={activeFeedbackReplay.hand}
        onBack={() => setActiveFeedbackReplay(null)}
        onClose={() => setActiveFeedbackReplay(null)}
      />
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 65%)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">History</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold">トーナメント & ハンド履歴</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/menu")}
          className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition text-sm"
        >
          Main Menu
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-8 sm:space-y-10">
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-950/20 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">プレイフィードバック</h2>
              <p className="text-sm text-slate-300">
                30ハンド以上のキャッシュゲームまたは選択中トーナメント履歴を使って、VPIP/PFR、ROI/チップ増減、
                showdown/all-in/split potをまとめたフィードバックを作成します。
              </p>
              <p className="mt-2 text-xs text-slate-400">
                対象: {selectedId ? `Tournament ${selectedId}` : "Cash game"} / Hands:{" "}
                {feedbackPayloadResult.handCount} / Minimum: {MIN_FEEDBACK_HANDS}
              </p>
              <label className="mt-3 block max-w-sm text-xs font-semibold text-slate-300">
                フィードバック対象
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-300/30"
                  value={selectedFeedbackScope}
                  onChange={(event) => {
                    setFeedbackScope(event.target.value);
                    setFeedbackState({ loading: false, error: null, response: null });
                  }}
                >
                  {feedbackScopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.handCount})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={handleRequestFeedback}
              disabled={
                feedbackState.loading ||
                !feedbackPayloadResult.eligible ||
                !hasStoredFeedbackAuth()
              }
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {feedbackState.loading ? "解析中..." : "AIフィードバック作成"}
            </button>
          </div>
          {!hasStoredFeedbackAuth() && (
            <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              ログインするとAIフィードバックを送信できます。
            </p>
          )}
          {!feedbackPayloadResult.eligible && (
            <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
              まだフィードバック対象外です。{MIN_FEEDBACK_HANDS}ハンド以上プレイしてください。
            </p>
          )}
          {feedbackState.error && (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {feedbackState.error}
            </p>
          )}
          {feedbackState.response && (
            <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-4 text-sm text-slate-100">
              <div className="mb-2 text-xs uppercase tracking-[0.25em] text-emerald-300">
                Feedback source: {feedbackState.response.source ?? "-"}
              </div>
              <p className="whitespace-pre-wrap">{feedbackState.response.adviceJa}</p>
              {feedbackState.response.adviceEn && (
                <p className="mt-3 text-slate-400">{feedbackState.response.adviceEn}</p>
              )}
            </div>
          )}
          {!feedbackState.response && savedFeedback?.response && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-100">
              <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                Saved feedback: {new Date(savedFeedback.createdAt).toLocaleString("ja-JP")}
              </div>
              <p className="whitespace-pre-wrap">{savedFeedback.response.adviceJa}</p>
            </div>
          )}
          {feedbackKeyHands.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-100">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Feedback key hands
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {feedbackKeyHands.map((spot) => (
                  <div
                    key={`${spot.situationId}-${spot.handId}`}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="font-semibold text-white">
                      {spot.situationId ?? "-"} / {spot.handId ?? "-"}
                    </div>
                    <div className="mt-1 text-slate-400">
                      {spot.variantId ?? "-"} · {spot.street ?? "-"} · {spot.heroAction ?? "-"} ·{" "}
                      {spot.actionSeqRange
                        ? `#${spot.actionSeqRange.start}-${spot.actionSeqRange.end}`
                        : "action -"}
                    </div>
                    {findFeedbackHand(spot.handId) ? (
                      <button
                        type="button"
                        className="mt-2 rounded-full border border-sky-300/30 px-3 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-300/10"
                        onClick={() => handleOpenFeedbackReplay(spot)}
                        data-testid="cash-review-replay"
                      >
                        Replay
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">キャッシュゲーム履歴</h2>
              <p className="text-sm text-slate-400">
                直近の完了ハンドを確認できます。ポット、勝者、ショーダウン、アクション数を残します。
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
              {cashHands.length} hands
            </span>
          </div>
          {cashHands.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">まだキャッシュゲームのハンド履歴がありません。</div>
          ) : (
            <div className="space-y-3">
              {cashHands.map((hand) => {
                const winners = getCashWinnersLabel(hand);
                const totalPot = getTotalPotLabel(hand);
                const actionCount = getActionCount(hand);
                const playerRows = getPlayerRows(hand);
                const potRows = Array.isArray(hand.pots) ? hand.pots : [];
                const variantLabel = getVariantLabel(hand);
                const evaluatorLabel = getEvaluatorLabel(hand);
                return (
                  <details
                    key={hand.handId}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                  >
                    <summary className="flex flex-col gap-3 cursor-pointer md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="font-semibold">Hand ID:</span>{" "}
                        <code>{hand.handId}</code>
                        <span className="ml-3 text-xs text-slate-400">
                          {fmt.format(new Date(hand.endedAt ?? hand.ts ?? hand.startedAt))}
                        </span>
                        <span className="ml-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-100">
                          {variantLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span>
                          Pot: <b>{totalPot}</b>
                        </span>
                        <span>
                          Winner: <b>{winners}</b>
                        </span>
                        <span>
                          Actions: <b>{actionCount}</b>
                        </span>
                      </div>
                    </summary>
                    <div className="mt-3 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Table</p>
                        <p>Variant: {variantLabel}</p>
                        <p>Evaluator: {evaluatorLabel}</p>
                        <p>Button: {hand.buttonSeat ?? "-"}</p>
                        <p>SB: {hand.sbSeat ?? "-"}</p>
                        <p>BB: {hand.bbSeat ?? "-"}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Result</p>
                        <p>Pot: {totalPot}</p>
                        <p>Winner: {winners}</p>
                        <p>Showdown: {hand.events?.some((event) => event?.type === "SHOWDOWN") ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {playerRows.length > 0 && (
                      <div className="mt-3 overflow-x-auto rounded-xl border border-white/5">
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-900/70 text-slate-400">
                            <tr>
                              <th className="p-2 text-left">Seat</th>
                              <th className="p-2 text-left">Player</th>
                              <th className="p-2 text-right">Stack</th>
                              <th className="p-2 text-right">Bet</th>
                              <th className="p-2 text-left">Status</th>
                              <th className="p-2 text-left">Hand / Eval</th>
                              <th className="p-2 text-left">Last action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerRows.map((player, idx) => (
                              <tr key={`${hand.handId}-cash-seat-${player.seat ?? idx}`} className="border-t border-white/5">
                                <td className="p-2">{player.seat ?? idx}</td>
                                <td className="p-2">{player.name ?? `Seat ${player.seat ?? idx}`}</td>
                                <td className="p-2 text-right">{player.stackAfter ?? player.stack ?? player.initialStack ?? "-"}</td>
                                <td className="p-2 text-right">{player.bet ?? player.totalBet ?? 0}</td>
                                <td className="p-2">
                                  {player.folded ? "Folded" : player.allIn ? "All-in" : player.busted ? "Busted" : "Active"}
                                </td>
                                <td className="p-2">{player.handLabel ?? player.evaluation?.handName ?? player.evaluation?.label ?? "-"}</td>
                                <td className="p-2">{player.action ?? player.lastAction ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {potRows.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
                        <p className="mb-2 font-semibold text-slate-200">Pot details</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {potRows.map((pot, idx) => (
                            <div key={`${hand.handId}-pot-${idx}`} className="rounded-lg bg-slate-950/50 p-2">
                              <span className="text-slate-400">{pot.label ?? pot.type ?? `Pot ${idx + 1}`}</span>
                              <b className="ml-2">{pot.amount ?? pot.value ?? "-"}</b>
                              {Array.isArray(pot.eligibleSeats) && (
                                <span className="ml-2 text-slate-400">
                                  eligible: {pot.eligibleSeats.join(", ")}
                                </span>
                              )}
                              {getPotWinnersLabel(pot) && (
                                <div className="mt-1 text-emerald-200">
                                  winners: {getPotWinnersLabel(pot)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(hand.events) && hand.events.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-semibold text-slate-200">Action Timeline</p>
                          <span className="text-slate-500">{hand.events.length} events</span>
                        </div>
                        <ol className="max-h-48 list-decimal list-inside space-y-1 overflow-y-auto text-slate-300">
                          {hand.events.map((event, idx) => (
                            <li key={`${hand.handId}-event-${idx}`}>{formatEvent(event)}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">トーナメント一覧</h2>
            <input
              type="search"
              placeholder="ID / Tier を検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full bg-slate-950/40 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">まだトーナメント履歴がありません。</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-300">
                  <tr>
                    <th className="text-left p-3">日付</th>
                    <th className="text-right p-3">Buy-in</th>
                    <th className="text-right p-3">参加数</th>
                    <th className="text-right p-3">着順</th>
                    <th className="text-right p-3">賞金</th>
                    <th className="text-left p-3">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const active = t.tournamentId === selectedId;
                    return (
                      <tr
                        key={t.tournamentId}
                        className={`border-t border-white/5 cursor-pointer ${
                          active ? "bg-emerald-500/10" : ""
                        }`}
                        onClick={() => setSelectedId(t.tournamentId)}
                      >
                        <td className="p-3">{fmt.format(new Date(t.tsEnd ?? t.tsStart))}</td>
                        <td className="p-3 text-right">{t.buyIn?.toLocaleString?.() ?? "-"}</td>
                        <td className="p-3 text-right">{t.entries ?? "-"}</td>
                        <td className="p-3 text-right font-semibold">{t.finish ?? "-"}</td>
                        <td className="p-3 text-right">{t.prize?.toLocaleString?.() ?? 0}</td>
                        <td className="p-3">{t.tier ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">ハンド振り返り</h3>
            {selectedId && (
              <span className="text-xs text-slate-400">
                Tournament ID:
                <code className="ml-2 text-slate-200">{selectedId}</code>
              </span>
            )}
          </div>
          {!selectedId ? (
            <p className="text-sm text-slate-400">トーナメントを選択するとハンド履歴が表示されます。</p>
          ) : hands.length === 0 ? (
            <p className="text-sm text-slate-400">このトーナメントのハンド履歴はまだありません。</p>
          ) : (
            <div className="space-y-3">
              {hands.map((hand) => (
                <details
                  key={hand.handId}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                >
                  <summary className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-semibold">Hand ID:</span>{" "}
                      <code>{hand.handId}</code>
                      <span className="ml-3 text-xs text-slate-400">
                        {fmt.format(new Date(hand.ts))}
                      </span>
                      <span className="ml-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-100">
                        {getVariantLabel(hand)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span>
                        Pot: <b>{hand.pot}</b>
                      </span>
                      <span>
                        Winner: <b>{(hand.winners ?? []).join(", ") || "-"}</b>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-900/70 text-slate-400">
                          <tr>
                            <th className="p-2 text-left">Seat</th>
                            <th className="p-2 text-left">Player</th>
                            <th className="p-2 text-right">Bet</th>
                            <th className="p-2 text-right">Stack (before → after)</th>
                            <th className="p-2 text-right">Draw</th>
                            <th className="p-2 text-left">Hand / Eval</th>
                            <th className="p-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(hand.playerSummaries ?? []).map((player) => (
                            <tr key={`${hand.handId}-${player.name}`} className="border-t border-white/5">
                              <td className="p-2">{player.seat}</td>
                              <td className="p-2">{player.name}</td>
                              <td className="p-2 text-right">{player.bet ?? 0}</td>
                              <td className="p-2 text-right">
                                {player.stackBefore} → <b>{player.stackAfter}</b>
                              </td>
                              <td className="p-2 text-right">{player.drawCount ?? 0}</td>
                              <td className="p-2">{player.handLabel ?? player.evaluation?.handName ?? player.evaluation?.label ?? "-"}</td>
                              <td className="p-2">{player.action || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {hand.actionLog && hand.actionLog.length > 0 && (
                      <div className="bg-slate-900/40 rounded-xl p-3 text-xs max-h-48 overflow-y-auto border border-white/5">
                        <div className="font-semibold mb-1">Action Log</div>
                        <ol className="space-y-1 list-decimal list-inside text-slate-300">
                          {hand.actionLog.map((entry, idx) => (
                            <li key={`${hand.handId}-log-${idx}`}>
                              [{entry.phase}] Seat {entry.seatName ?? entry.seat} : {entry.type}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
