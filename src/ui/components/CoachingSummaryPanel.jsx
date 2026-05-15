import React from "react";

function formatEv(value = 0) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

function copyFor(lesson = {}, locale = "jp") {
  return {
    title: locale === "en" ? lesson.titleEn ?? lesson.lessonTag : lesson.titleJp ?? lesson.lessonTag,
    body: locale === "en" ? lesson.en : lesson.jp,
    replay: locale === "en" ? "View replay" : "リプレイを見る",
    helpful: locale === "en" ? "Helpful" : "役に立った",
    notHelpful: locale === "en" ? "Not helpful" : "いまいち",
  };
}

export default function CoachingSummaryPanel({
  summary,
  locale = "jp",
  onReplay,
  onHelpful,
  onNotHelpful,
  onOpened,
}) {
  const lessons = summary?.topLessons ?? [];
  if (!lessons.length) {
    return (
      <section
        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-slate-200"
        data-testid="coaching-summary-empty"
      >
        {locale === "en" ? "No coaching lessons for this tournament." : "今回表示する学習ポイントはありません。"}
      </section>
    );
  }
  const heading = locale === "en" ? summary.summary?.en : summary.summary?.jp;
  return (
    <section
      className="rounded-2xl border border-yellow-300/35 bg-black/60 px-4 py-4 shadow-lg shadow-black/20"
      data-testid="coaching-summary-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-200">
            Coaching Summary
          </p>
          <h3 className="mt-1 text-base font-semibold text-white" data-testid="coaching-summary-heading">
            {heading}
          </h3>
        </div>
        <span
          className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100"
          data-testid="coaching-summary-total-ev"
        >
          EV {formatEv(summary.totalEstimatedEVGain)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {lessons.slice(0, 3).map((lesson) => {
          const text = copyFor(lesson, locale);
          return (
            <article
              key={lesson.lessonId}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3"
              data-testid="coaching-summary-lesson"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full bg-yellow-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-100"
                      data-testid="coaching-summary-severity"
                    >
                      {lesson.severity}
                    </span>
                    <span className="text-xs text-slate-300">{lesson.variantId}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-white" data-testid="coaching-summary-title">
                    {text.title}
                  </h4>
                </div>
                <span className="text-xs font-semibold text-emerald-100" data-testid="coaching-summary-ev">
                  {formatEv(lesson.estimatedEVGain)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-200">{text.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpened?.(lesson)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-white/10"
                  data-testid="coaching-summary-open"
                  aria-label="Open coaching lesson"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onHelpful?.(lesson)}
                  className="rounded-full border border-yellow-200/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-100 hover:bg-yellow-200/10"
                  data-testid="coaching-summary-helpful"
                  aria-label="Mark lesson helpful"
                >
                  {text.helpful}
                </button>
                <button
                  type="button"
                  onClick={() => onNotHelpful?.(lesson)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:bg-white/10"
                  data-testid="coaching-summary-not-helpful"
                  aria-label="Mark lesson not helpful"
                >
                  {text.notHelpful}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onReplay?.({
                      lessonId: lesson.lessonId,
                      replayRef: lesson.replayRef,
                      href: lesson.replayUrl ?? lesson.replayCta?.href,
                      deterministic: lesson.replayDeterministic === true,
                    })
                  }
                  className="rounded-full border border-yellow-200/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100 hover:bg-yellow-200/10 disabled:cursor-not-allowed disabled:text-white/35"
                  data-testid="coaching-summary-replay"
                  aria-label="Open lesson replay"
                  disabled={lesson.replayDeterministic !== true}
                >
                  {text.replay}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
