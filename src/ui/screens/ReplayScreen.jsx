import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { replayHandFromHistory } from "../../games/badugi/flow/handReplay.js";
import {
  extractDecisionContext,
  generateBetCandidates,
  generateDrawCandidates,
} from "../../games/badugi/analysis/featureExtract.js";
import { buildTrainingIndex, estimateEvForAction } from "../../games/badugi/analysis/evEstimator.js";
import {
  findHandHistoryById,
  getHandHistoryBufferSnapshot,
} from "../state/handHistoryStore.js";
import { findReplayFrameIndex } from "./replayFrameUtils.js";
import ReplayCoachingOverlay from "../components/ReplayCoachingOverlay.jsx";

function formatTimestamp(ts) {
  if (!Number.isFinite(ts)) return "–";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return `${ts}`;
  }
}

function eventToLabel(event = {}) {
  switch (event.type) {
    case "HAND_START":
      return "Hand start";
    case "BLINDS_POSTED":
      return `Blinds · SB ${event.sbSeat}(${event.sbAmount}) · BB ${event.bbSeat}(${event.bbAmount})`;
    case "BET_ACTION":
      return `Seat ${event.seat} ${event.action} Δ${event.amount}${
        event.actionSeq ? ` · #${event.actionSeq}` : ""
      }`;
    case "DRAW_ACTION":
      return `Seat ${event.seat} draw discarding ${(event.discarded ?? []).join(", ") || "—"}${
        event.actionSeq ? ` · #${event.actionSeq}` : ""
      }`;
    case "PHASE_TRANSITION":
      return `${event.from ?? "?"} → ${event.to ?? "?"}`;
    case "SHOWDOWN":
      return "Showdown";
    case "HAND_END":
      return `Hand end · Pot ${event.totalPot ?? 0}`;
    default:
      return event.type ?? "Event";
  }
}

function getSeatFromFrameEvent(frame) {
  if (!frame || !frame.event) {
    const fallbackWinner = Array.isArray(frame?.winners) ? frame.winners : null;
    if (fallbackWinner?.length && Number.isInteger(fallbackWinner[0]?.seat)) {
      return fallbackWinner[0].seat;
    }
    return null;
  }
  const candidateKeys = [
    frame.event.seat,
    frame.event.actorSeat,
    frame.event.playerSeat,
    frame.event.fromSeat,
    frame.event?.metadata?.seat,
    frame.event?.payload?.seat,
  ];
  const winnerCandidate =
    frame.event?.type === "HAND_END" && Array.isArray(frame.event?.winners)
      ? frame.event.winners[0]?.seat
      : null;
  candidateKeys.push(winnerCandidate);
  const seat = candidateKeys.find((value) => Number.isInteger(value) && value >= 0);
  return Number.isInteger(seat) && seat >= 0 ? seat : null;
}

function formatChips(amount) {
  if (!Number.isFinite(amount)) return null;
  try {
    return Math.round(amount).toLocaleString();
  } catch {
    return `${Math.round(amount)}`;
  }
}

function formatSignedChips(amount) {
  if (!Number.isFinite(amount)) return null;
  const absolute = formatChips(Math.abs(amount));
  return `${amount >= 0 ? "+" : "-"}${absolute}`;
}

function deriveAnalysis(frame, handHistory) {
  if (!frame || !handHistory) return null;
  const context = extractDecisionContext(handHistory, frame?.index ?? null);
  if (context) return context;
  const fallbackActingSeat =
    Number.isInteger(frame?.actingPlayerIndex) && frame.actingPlayerIndex >= 0
      ? frame.actingPlayerIndex
      : null;
  return {
    phase: frame?.phase ?? null,
    actingSeat: fallbackActingSeat,
    actorSeat: fallbackActingSeat ?? getSeatFromFrameEvent(frame),
    pot: frame?.pot ?? null,
    eventType: frame?.event?.type ?? frame?.eventType ?? null,
    fallbackOnly: true,
  };
}

function buildBufferKey(buffer) {
  if (!Array.isArray(buffer) || !buffer.length) return "empty";
  return buffer.map((entry, idx) => entry?.handId ?? `hand-${idx}`).join("|");
}

function ReplayHighlightLegend() {
  const items = [
    {
      label: "BET acting seat",
      className: "ring-2 ring-white/40 bg-white/10",
    },
    {
      label: "DRAW acting seat",
      className: "ring-2 ring-emerald-400/40 bg-emerald-500/5",
    },
    {
      label: "Winner",
      className: "ring-2 ring-amber-300/60 bg-amber-300/10",
    },
    {
      label: "Flash / Preview",
      className: "outline outline-1 outline-sky-300/40 bg-sky-300/10",
    },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
      <div className="flex flex-wrap items-center gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-md border border-white/10 ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function confidenceClasses(level) {
  switch (level) {
    case "high":
      return "border border-emerald-400/40 bg-emerald-400/15 text-emerald-100";
    case "medium":
      return "border border-amber-400/40 bg-amber-400/15 text-amber-100";
    default:
      return "border border-slate-500/40 bg-slate-500/15 text-slate-200";
  }
}

function ReplayTableView({ frame, flashSeat = null, hoverSeat = null }) {
  const players = Array.isArray(frame?.players) ? frame.players : [];
  const phase = frame?.phase ?? null;
  const eventType = frame?.event?.type ?? frame?.eventType ?? null;
  const collectedWinners = [
    ...(Array.isArray(frame?.winners) ? frame.winners : []),
    ...(Array.isArray(frame?.summary?.winners) ? frame.summary.winners : []),
    ...(Array.isArray(frame?.handResult?.winners) ? frame.handResult.winners : []),
  ];
  const payoutBySeat = collectedWinners.reduce((acc, entry) => {
    if (Number.isInteger(entry?.seat) && entry.seat >= 0) {
      const amountCandidates = [
        entry.amount,
        entry.payout,
        entry.winAmount,
        entry.value,
        entry.total,
      ];
      const payout =
        amountCandidates.find((candidate) => Number.isFinite(candidate)) ?? null;
      acc.set(entry.seat, payout);
    }
    return acc;
  }, new Map());
  const winnerSeats = new Set(payoutBySeat.keys());
  const hasWinnerData = winnerSeats.size > 0;
  const isEndFrame =
    eventType === "HAND_END" ||
    phase === "HAND_RESULT" ||
    (phase === "SHOWDOWN" && hasWinnerData) ||
    hasWinnerData;
  const rawActingSeat =
    Number.isInteger(frame?.actingPlayerIndex) && frame.actingPlayerIndex >= 0
      ? frame.actingPlayerIndex
      : null;
  const highlightEnabled = !isEndFrame && (phase === "BET" || phase === "DRAW");
  const actingPlayer = rawActingSeat != null ? players[rawActingSeat] : null;
  const actingPlayerEligible =
    actingPlayer &&
    actingPlayer.folded !== true &&
    actingPlayer.isActiveInGame !== false &&
    actingPlayer.allIn !== true;
  const actingSeat =
    highlightEnabled && rawActingSeat != null && actingPlayerEligible ? rawActingSeat : null;
  const actingClass =
    phase === "DRAW"
      ? "ring-2 ring-emerald-400/40 border-emerald-400/80 bg-emerald-500/5"
      : "ring-2 ring-white/40 border-emerald-200/60 bg-emerald-200/5";
  const winnerClass = "ring-2 ring-amber-300/60 border-amber-300/70 bg-amber-300/5";
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur">
      <div className="grid gap-2 text-sm text-slate-200 md:grid-cols-2">
        {players.map((player, idx) => (
          <div
            key={`seat-${idx}`}
            className={`rounded-2xl border px-3 py-2 ${
              winnerSeats.has(idx) && isEndFrame
                ? winnerClass
                : idx === actingSeat
                  ? actingClass
                  : "border-white/10"
            } ${
              flashSeat === idx
                ? "animate-pulse outline outline-1 outline-sky-300/40 bg-sky-300/5"
                : hoverSeat === idx
                  ? "outline outline-1 outline-sky-300/30 bg-sky-300/5"
                  : ""
            }`}
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Seat {idx}</span>
              {idx === actingSeat && !winnerSeats.has(idx) && !isEndFrame && <span>Acting</span>}
              {winnerSeats.has(idx) && isEndFrame && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.25em] text-amber-200">
                  <span>WIN</span>
                  {formatChips(payoutBySeat.get(idx)) && (
                    <span className="text-amber-100/90">
                      +{formatChips(payoutBySeat.get(idx))}
                    </span>
                  )}
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-white">{player?.name ?? `Seat ${idx}`}</p>
            <div className="mt-1 text-xs text-slate-300">
              Stack {player?.stack ?? 0} · Invested {player?.totalInvested ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {player?.folded ? "Folded · " : ""}
              {player?.allIn ? "All-in · " : ""}
              {player?.hasDrawn ? "Drawn" : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-emerald-200">Pot: {frame?.pot ?? 0}</div>
    </div>
  );
}

export default function ReplayScreen({
  handId = null,
  target = null,
  lessonFocus = null,
  coachingAnnotation = null,
  coachingLocale = "jp",
  onCoachingTelemetry,
  onClose = () => {},
  onBack = () => {},
}) {
  const [handSnapshot, setHandSnapshot] = useState(() =>
    handId ? findHandHistoryById(handId) ?? null : null,
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIntervalMs, setPlayIntervalMs] = useState(250);
  const [flashSeat, setFlashSeat] = useState(null);
  const [hoverSeat, setHoverSeat] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [trainingRequestKey, setTrainingRequestKey] = useState(0);
  const [trainingState, setTrainingState] = useState({ status: "idle", index: null, metadata: null });
  const trainingCacheRef = useRef({ key: null, index: null });
  const flashTimerRef = useRef(null);
  const frames = useMemo(
    () => (handSnapshot ? replayHandFromHistory(handSnapshot) : []),
    [handSnapshot],
  );
  const maxFrameIndex = Math.max(frames.length - 1, 0);
  const clampedIndex = Math.min(Math.max(frameIndex, 0), maxFrameIndex);
  const currentFrame = frames[clampedIndex] ?? null;
  const analysis = useMemo(
    () => deriveAnalysis(currentFrame, handSnapshot),
    [currentFrame, handSnapshot],
  );
  const trainingIndex = trainingState?.index ?? null;
  const candidateResults = useMemo(() => {
    if (!analysis || analysis.fallbackOnly || !analysis.signature) return null;
    if (!trainingIndex) return null;
    const phase = analysis.phase?.toUpperCase();
    const generator =
      phase === "BET" ? generateBetCandidates : phase === "DRAW" ? generateDrawCandidates : null;
    if (!generator) return null;
    const baseCandidates = generator(analysis) ?? [];
    const results = baseCandidates.map((candidate) => {
      const stats = estimateEvForAction({
        trainingIndex,
        signature: analysis.signature,
        actionKey: candidate.actionKey,
      });
      return { ...candidate, ...stats };
    });
    results.sort((a, b) => {
      const av = Number.isFinite(a.ev) ? a.ev : -Infinity;
      const bv = Number.isFinite(b.ev) ? b.ev : -Infinity;
      return bv - av;
    });
    return results;
  }, [analysis, trainingIndex]);
  const topRecommendation = useMemo(() => {
    if (!candidateResults) return null;
    return candidateResults.find((candidate) => Number.isFinite(candidate.ev)) ?? null;
  }, [candidateResults]);
  const triggerSeatFlash = useCallback((seat) => {
    if (!Number.isInteger(seat) || seat < 0) return;
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setFlashSeat(seat);
    flashTimerRef.current = setTimeout(() => {
      setFlashSeat(null);
      flashTimerRef.current = null;
    }, 600);
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const buffer = getHandHistoryBufferSnapshot();
    const bufferKey = buildBufferKey(buffer);
    const cached = trainingCacheRef.current;
    if (cached.key === bufferKey && cached.index) {
      setTrainingState({ status: "ready", index: cached.index, metadata: cached.index.metadata });
      return undefined;
    }
    setTrainingState((prev) => ({ ...prev, status: "building" }));
    const runBuild = () => {
      const snapshot = getHandHistoryBufferSnapshot();
      const key = buildBufferKey(snapshot);
      const built = buildTrainingIndex(snapshot);
      if (cancelled) return;
      trainingCacheRef.current = { key, index: built };
      setTrainingState({ status: "ready", index: built, metadata: built.metadata });
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(runBuild);
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = setTimeout(runBuild, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trainingRequestKey]);

  const refreshSnapshot = useCallback(() => {
    if (!handId) {
      setHandSnapshot(null);
      setFrameIndex(0);
      setIsPlaying(false);
      setTrainingRequestKey((key) => key + 1);
      return;
    }
    const snapshot = findHandHistoryById(handId) ?? null;
    if (!snapshot) {
      setHandSnapshot(null);
      setFrameIndex(0);
      setIsPlaying(false);
      setTrainingRequestKey((key) => key + 1);
      return;
    }
    const nextFrames = replayHandFromHistory(snapshot);
    setHandSnapshot(snapshot);
    setFrameIndex((value) => Math.min(Math.max(value, 0), Math.max(nextFrames.length - 1, 0)));
    setTrainingRequestKey((key) => key + 1);
  }, [handId]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    setFrameIndex((prev) => {
      const normalized = Math.min(Math.max(prev, 0), maxFrameIndex);
      return Number.isFinite(normalized) ? normalized : 0;
    });
  }, [maxFrameIndex]);

  const activeReplayTarget = lessonFocus?.focusMode === "coaching-lesson" ? lessonFocus.target : target;
  const lessonFocusUnavailable = lessonFocus && lessonFocus.status !== "ready";
  const lessonActionIndex = Number.isInteger(lessonFocus?.actionIndex)
    ? lessonFocus.actionIndex
    : Number.isInteger(coachingAnnotation?.actionIndex)
      ? coachingAnnotation.actionIndex
      : null;

  useEffect(() => {
    const targetIndex = findReplayFrameIndex(frames, activeReplayTarget);
    if (targetIndex < 0) return;
    setFrameIndex(targetIndex);
    const seat = getSeatFromFrameEvent(frames[targetIndex]);
    if (seat != null) {
      triggerSeatFlash(seat);
    }
  }, [frames, activeReplayTarget, triggerSeatFlash]);

  const goToIndex = useCallback(
    (next) => {
      setFrameIndex((value) => {
        const normalized = Math.min(Math.max(next, 0), maxFrameIndex);
        return Number.isFinite(normalized) ? normalized : value;
      });
    },
    [maxFrameIndex],
  );

  const handlePrev = useCallback(() => goToIndex(clampedIndex - 1), [goToIndex, clampedIndex]);
  const handleNext = useCallback(() => goToIndex(clampedIndex + 1), [goToIndex, clampedIndex]);
  const handleFirst = useCallback(() => goToIndex(0), [goToIndex]);
  const handleLast = useCallback(() => goToIndex(frames.length - 1), [goToIndex, frames.length]);
  useEffect(() => {
    if (isPlaying && (frames.length <= 1 || clampedIndex >= maxFrameIndex)) {
      setIsPlaying(false);
    }
  }, [isPlaying, frames.length, clampedIndex, maxFrameIndex]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return undefined;
    const id = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          setIsPlaying(false);
          return Math.min(prev, maxFrameIndex);
        }
        return next;
      });
    }, Math.max(50, playIntervalMs));
    return () => {
      clearInterval(id);
    };
  }, [isPlaying, playIntervalMs, frames.length, maxFrameIndex]);
  const emitCoachingTelemetry = useCallback(
    (type, annotation = coachingAnnotation) => {
      if (typeof onCoachingTelemetry === "function" && annotation) {
        onCoachingTelemetry(type, annotation);
      }
    },
    [coachingAnnotation, onCoachingTelemetry],
  );

  return (
    <div
      className="min-h-screen bg-slate-950/95 px-6 py-8 text-slate-100"
      data-testid="hand-replay-screen"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">MGX</p>
            <h1 className="text-2xl font-semibold text-white">Hand Replay</h1>
            <p className="text-sm text-slate-300/80">
              {handSnapshot?.handId ? `Hand ${handSnapshot.handId}` : "Hand data unavailable"} ·
              Started {formatTimestamp(handSnapshot?.startedAt)} · Ended
              {" "}
              {formatTimestamp(handSnapshot?.endedAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={refreshSnapshot}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-emerald-300/70 hover:text-emerald-200"
              onClick={onBack}
            >
              Back to History
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/90 hover:border-red-300/70 hover:text-red-200"
              onClick={() => {
                emitCoachingTelemetry("REPLAY_COMPLETED");
                onClose();
              }}
            >
              Exit
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-300">
            <div data-testid="replay-frame-counter">
              Frame {frames.length === 0 ? 0 : clampedIndex + 1} / {frames.length || 0}
            </div>
            <div>Phase: {currentFrame?.phase ?? "—"}</div>
            <div>
              Acting Seat:{" "}
              {Number.isInteger(currentFrame?.actingPlayerIndex)
                ? currentFrame.actingPlayerIndex
                : "—"}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFirst}
              data-testid="replay-first-frame"
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-emerald-300/70"
              disabled={!frames.length || clampedIndex === 0}
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={handlePrev}
              data-testid="replay-prev-frame"
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-emerald-300/70"
              disabled={!frames.length || clampedIndex === 0}
            >
              ◀
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={clampedIndex}
              onChange={(event) => goToIndex(Number(event.target.value))}
              data-testid="replay-frame-slider"
              className="flex-1 accent-emerald-400"
            />
            <button
              type="button"
              onClick={handleNext}
              data-testid="replay-next-frame"
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-emerald-300/70"
              disabled={!frames.length || clampedIndex >= frames.length - 1}
            >
              ▶
            </button>
            <button
              type="button"
              onClick={handleLast}
              data-testid="replay-last-frame"
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-emerald-300/70"
              disabled={!frames.length || clampedIndex >= frames.length - 1}
            >
              ⏭
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((value) => !value)}
              data-testid="replay-play-toggle"
              className={`rounded-full border px-3 py-1 text-xs ${
                isPlaying
                  ? "border-red-300/70 text-red-200"
                  : "border-emerald-300/80 text-emerald-200"
              }`}
              disabled={frames.length <= 1}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <select
              value={playIntervalMs}
              onChange={(event) => setPlayIntervalMs(Number(event.target.value))}
              data-testid="replay-speed-select"
              className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-white"
            >
              {[100, 250, 500].map((ms) => (
                <option key={ms} value={ms}>
                  {ms} ms
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ReplayHighlightLegend />
          {coachingAnnotation ? (
            <ReplayCoachingOverlay
              annotation={coachingAnnotation}
              locale={coachingLocale}
              onAcknowledged={(annotation) => emitCoachingTelemetry("LESSON_ACKNOWLEDGED", annotation)}
              onHelpful={(annotation) => emitCoachingTelemetry("LESSON_HELPFUL", annotation)}
              onNotHelpful={(annotation) => emitCoachingTelemetry("LESSON_NOT_HELPFUL", annotation)}
              onDismissed={(annotation) => emitCoachingTelemetry("LESSON_DISMISSED", annotation)}
            />
          ) : null}
          {lessonFocus?.focusMode === "coaching-lesson" ? (
            <div
              className="rounded-2xl border border-yellow-300/35 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-50"
              data-testid="replay-coaching-focus"
            >
              Coaching lesson focus · {lessonFocus.lessonId} · action #{lessonFocus.actionIndex}
            </div>
          ) : null}
          {lessonFocusUnavailable ? (
            <div
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300"
              data-testid="replay-coaching-fallback"
            >
              Coaching replay preview unavailable. Replay remains safe to inspect.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAnalysis((value) => !value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
            >
              {showAnalysis ? "Hide Analysis" : "Show Analysis"}
            </button>
          </div>
          {showAnalysis && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Analysis</p>
                <span className="text-xs text-slate-400">
                  Frame {frames.length === 0 ? 0 : clampedIndex + 1} / {frames.length || 0}
                </span>
              </div>

              {!analysis && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                  No analysis available for this frame.
                </div>
              )}

              {analysis && (
                <>
                  {/* 既存の analysis UI をこの枠内で維持 */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Phase</p>
                      <p className="text-base text-white">{analysis.phase ?? "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        Acting Seat
                      </p>
                      <p className="text-base text-white">
                        {Number.isInteger(analysis.actorSeat ?? analysis.actingSeat)
                          ? analysis.actorSeat ?? analysis.actingSeat
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        Position
                      </p>
                      <p className="text-base text-white">{analysis.positionBucket ?? "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Pot</p>
                      <p className="text-base text-white">
                        {formatChips(analysis.pot) ?? analysis.potBucket ?? "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        To call
                      </p>
                      <p className="text-base text-white">
                        {Number.isFinite(analysis.toCall)
                          ? `${formatChips(analysis.toCall)}`
                          : analysis.toCallBucket ?? "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        Stack buckets
                      </p>
                      <p className="text-base text-white">
                        {Array.isArray(analysis.stackBuckets) && analysis.stackBuckets.length
                          ? analysis.stackBuckets.join(", ")
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Training data:{" "}
                    {trainingState.status === "building"
                      ? "Building index…"
                    : trainingState.metadata
                    ? `${trainingState.metadata.sampleCount} samples from ${trainingState.metadata.usableHands}/${trainingState.metadata.totalHands} hands`
                    : "Not available"}
                </div>
                <div className="mt-4">
                  {trainingState.status === "building" && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                      Building training index…
                    </div>
                  )}
                  {trainingState.status !== "building" && (!candidateResults || !candidateResults.length) && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                      Not enough samples for this phase/signature.
                    </div>
                  )}
                  {candidateResults && candidateResults.length > 0 && (
                    <>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                          Recommended action
                        </p>
                        {topRecommendation ? (
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <div>
                              <p className="text-lg font-semibold text-white">
                                {topRecommendation.label}
                              </p>
                              <p className="text-xs text-white/60">{topRecommendation.description}</p>
                            </div>
                            <div className="text-sm text-emerald-200">
                              EV {formatSignedChips(topRecommendation.ev) ?? "N/A"}
                              {Number.isFinite(topRecommendation.deltaEv) && (
                                <span className="ml-2 text-emerald-100/80">
                                  (Δ {formatSignedChips(topRecommendation.deltaEv)})
                                </span>
                              )}
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] ${confidenceClasses(topRecommendation.confidence)}`}
                            >
                              {topRecommendation.confidence ?? "low"} · n={topRecommendation.n ?? 0}
                            </span>
                            {Number.isFinite(topRecommendation.ci95) && (
                              <span className="text-xs text-white/60">
                                ±{formatChips(topRecommendation.ci95)} (95% CI)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-white/70">Insufficient confidence.</p>
                        )}
                        {topRecommendation?.closestHands?.length ? (
                          <div className="mt-2 text-xs text-white/60">
                            Closest matches: {topRecommendation.closestHands.join(", ")}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                          Alternatives
                        </p>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="px-2 py-1">Action</th>
                                <th className="px-2 py-1">EV</th>
                                <th className="px-2 py-1">ΔEV</th>
                                <th className="px-2 py-1">n</th>
                                <th className="px-2 py-1">Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {candidateResults.map((candidate) => (
                                <tr
                                  key={candidate.actionKey}
                                  className="border-t border-white/5 text-white/80"
                                >
                                  <td className="px-2 py-1">{candidate.label}</td>
                                  <td className="px-2 py-1">
                                    {formatSignedChips(candidate.ev) ?? "N/A"}
                                  </td>
                                  <td className="px-2 py-1">
                                    {formatSignedChips(candidate.deltaEv) ?? "—"}
                                  </td>
                                  <td className="px-2 py-1">{candidate.n ?? 0}</td>
                                  <td className="px-2 py-1">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] ${confidenceClasses(
                                        candidate.confidence,
                                      )}`}
                                    >
                                      {candidate.confidence ?? "low"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          )}

        <ReplayTableView frame={currentFrame} flashSeat={flashSeat} hoverSeat={hoverSeat} />

        <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Events</p>
          <div className="mt-3 grid gap-2">
            {frames.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-slate-300">
                No replay data available for this hand.
              </div>
            )}
            {frames.map((frame, idx) => (
              (() => {
                const actionSeq = Number(frame?.event?.actionSeq ?? idx);
                const isLessonAction =
                  lessonActionIndex !== null && (idx === lessonActionIndex || actionSeq === lessonActionIndex);
                return (
              <button
                key={`evt-${idx}-${frame?.phase}`}
                type="button"
                data-testid={`replay-event-row-${idx}`}
                data-coaching-highlight={isLessonAction ? "true" : "false"}
                onClick={() => {
                  goToIndex(idx);
                  const seat = getSeatFromFrameEvent(frames[idx]);
                  if (seat != null) {
                    triggerSeatFlash(seat);
                  } else {
                    setFlashSeat(null);
                  }
                  setHoverSeat(null);
                }}
                onMouseEnter={() => setHoverSeat(getSeatFromFrameEvent(frames[idx]))}
                onMouseLeave={() => setHoverSeat(null)}
                onFocus={() => setHoverSeat(getSeatFromFrameEvent(frames[idx]))}
                onBlur={() => setHoverSeat(null)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  isLessonAction
                    ? "border-yellow-300/90 bg-yellow-300/10 text-white shadow shadow-yellow-500/10"
                    : idx === clampedIndex
                    ? "border-emerald-400/80 bg-emerald-500/5 text-white"
                    : "border-white/10 bg-black/20 text-slate-200 hover:border-emerald-300/60 hover:text-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                  <span>
                    Frame {idx + 1} · {frame?.phase ?? "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    {isLessonAction ? (
                      <span
                        className="rounded-full border border-yellow-200/50 bg-yellow-300/15 px-2 py-0.5 text-[10px] text-yellow-100"
                        data-testid="replay-coaching-timeline-marker"
                      >
                        Coaching
                      </span>
                    ) : null}
                    {frame?.event?.type ?? "—"}
                  </span>
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {eventToLabel(frame?.event)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Pot {frame?.pot ?? 0} · Acting{" "}
                  {Number.isInteger(frame?.actingPlayerIndex)
                    ? frame.actingPlayerIndex
                    : "—"}
                </div>
              </button>
                );
              })()
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
