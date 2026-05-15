import React, { useEffect, useRef } from "react";
import CoachingPreviewCard from "./CoachingPreviewCard.jsx";
import CoachingSummaryPanel from "./CoachingSummaryPanel.jsx";

export default function TournamentResultOverlay({
  visible,
  placements = [],
  title = "Tournament Results",
  coachingPreview = null,
  coachingLocale = "jp",
  onCoachingReplay,
  onCoachingTelemetry,
  onBackToMenu,
  onPlayAgain,
}) {
  const shownKeyRef = useRef(null);
  const visibleLessons = coachingPreview?.summary?.topLessons ?? coachingPreview?.lessons?.slice(0, 2) ?? [];
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        className="w-full max-w-2xl bg-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-2xl border border-emerald-500/20"
        data-testid="mtt-result-overlay"
      >
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Tournament Complete
          </p>
          <h2 className="text-3xl font-bold">{title}</h2>
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
