import React from "react";

function formatEv(value = 0) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

export default function CoachingPreviewCard({
  lesson,
  locale = "jp",
  onReplay,
  onOpened,
  onAcknowledged,
  onHelpful,
  onNotHelpful,
  onDismissed,
  replayDisabled = false,
}) {
  if (!lesson) return null;
  const text = locale === "en" ? lesson.en : lesson.jp;
  const handleReplay = () => {
    if (!replayDisabled && typeof onReplay === "function") {
      onReplay({
        lessonId: lesson.lessonId,
        replayRef: lesson.replayRef,
        href: lesson.replayUrl,
        deterministic: lesson.replayDeterministic,
      });
    }
  };
  return (
    <section
      className="rounded-2xl border border-yellow-300/35 bg-black/55 px-4 py-3 text-left shadow-lg shadow-black/20"
      data-testid="coaching-preview-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-200">
            Coaching Preview
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">
            {lesson.lessonTag} · {lesson.variantId}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
          <span className="rounded-full border border-yellow-200/40 bg-yellow-300/15 px-2 py-1 text-yellow-100">
            {lesson.severity}
          </span>
          <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-1 text-emerald-100">
            EV {formatEv(lesson.estimatedEVGain)}
          </span>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-200">
        {text}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          {lesson.baselineAction}
          {" -> "}
          {lesson.recommendedAction}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpened?.(lesson)}
            className="rounded-full border border-white/15 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
            data-testid="coaching-preview-open"
            aria-label="Open coaching lesson preview"
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => onAcknowledged?.(lesson)}
            className="rounded-full border border-emerald-200/35 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-200/10"
            data-testid="coaching-preview-ack"
            aria-label="Acknowledge coaching lesson"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={() => onHelpful?.(lesson)}
            className="rounded-full border border-yellow-200/30 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-yellow-100 transition hover:bg-yellow-200/10"
            data-testid="coaching-preview-helpful"
            aria-label="Mark coaching lesson helpful"
          >
            Helpful
          </button>
          <button
            type="button"
            onClick={() => onNotHelpful?.(lesson)}
            className="rounded-full border border-white/15 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
            data-testid="coaching-preview-not-helpful"
            aria-label="Mark coaching lesson not helpful"
          >
            Not helpful
          </button>
          <button
            type="button"
            onClick={() => onDismissed?.(lesson)}
            className="rounded-full border border-white/15 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
            data-testid="coaching-preview-dismiss"
            aria-label="Dismiss coaching lesson"
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={replayDisabled || !lesson.replayDeterministic}
            onClick={handleReplay}
            className="rounded-full border border-yellow-200/40 px-3 py-1.5 font-semibold uppercase tracking-[0.22em] text-yellow-100 transition hover:bg-yellow-200/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/35"
            data-testid="coaching-preview-replay"
            aria-label="Open coaching replay"
          >
            Replay
          </button>
        </div>
      </div>
    </section>
  );
}
