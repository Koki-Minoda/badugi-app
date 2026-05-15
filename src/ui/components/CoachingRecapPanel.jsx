import React from "react";

function formatEv(value = 0) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

function sectionCopy(locale = "jp") {
  if (locale === "en") {
    return {
      heading: "Recent learning",
      repeated: "Repeated leaks",
      replay: "Revisited replays",
      helpful: "Helpful lessons",
      next: "Next focus",
      clear: "Clear preview history",
      replayCta: "View replay",
      empty: "No coaching history yet.",
      allVariants: "All",
      emptyVariant: "No lessons for this variant yet.",
    };
  }
  return {
    heading: "最近の学習",
    repeated: "よく出る課題",
    replay: "見直したリプレイ",
    helpful: "役に立ったレッスン",
    next: "次に意識すること",
    clear: "プレビュー履歴を消す",
    replayCta: "リプレイを見る",
    empty: "まだ学習履歴はありません。",
    allVariants: "すべて",
    emptyVariant: "この種目の学習履歴はまだありません。",
  };
}

function collectVariants(recap) {
  const variants = new Set(Object.keys(recap?.byVariant ?? {}));
  (recap?.recentLessons ?? []).forEach((lesson) => {
    if (lesson.variantId) variants.add(lesson.variantId);
  });
  return [...variants].filter(Boolean).sort();
}

function selectRepeatedLeak(recap, selectedVariant) {
  if (selectedVariant && selectedVariant !== "all") {
    return recap?.byVariant?.[selectedVariant]?.repeatedLeaks?.[0] ?? null;
  }
  return recap?.repeatedLeaks?.[0] ?? null;
}

export default function CoachingRecapPanel({
  recap,
  locale = "jp",
  onReplay,
  onClearHistory,
  selectedVariant = "all",
  onVariantChange,
  showVariantFilter = true,
}) {
  const copy = sectionCopy(locale);
  const variants = collectVariants(recap);
  const allLessons = recap?.recentLessons ?? [];
  const lessons = allLessons
    .filter((lesson) => selectedVariant === "all" || lesson.variantId === selectedVariant)
    .slice(0, 5);
  if (!lessons.length) {
    return (
      <section
        className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-sm text-slate-200"
        data-testid="coaching-recap-empty"
      >
        {selectedVariant === "all" ? copy.empty : copy.emptyVariant}
      </section>
    );
  }
  const repeated = selectRepeatedLeak(recap, selectedVariant);
  return (
    <section
      className="rounded-2xl border border-yellow-300/35 bg-black/60 px-4 py-4 text-white shadow-lg shadow-black/20"
      data-testid="coaching-recap-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-200">
            Coaching Recap
          </p>
          <h3 className="mt-1 text-base font-semibold" data-testid="coaching-recap-heading">
            {copy.heading}
          </h3>
        </div>
        <span
          className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100"
          data-testid="coaching-recap-ev"
        >
          EV {formatEv(recap.estimatedTotalEVReviewed)}
        </span>
      </div>

      {showVariantFilter && variants.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Coaching recap variant filter">
          {[{ id: "all", label: copy.allVariants }, ...variants.map((variant) => ({ id: variant, label: variant }))].map((variant) => (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={selectedVariant === variant.id}
              onClick={() => onVariantChange?.(variant.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                selectedVariant === variant.id
                  ? "border-yellow-200/60 bg-yellow-200/15 text-yellow-50"
                  : "border-white/15 text-slate-300 hover:bg-white/10"
              }`}
              data-testid="coaching-recap-variant-tab"
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {copy.repeated}
          </p>
          <p className="mt-1 text-sm font-semibold text-yellow-100" data-testid="coaching-recap-repeated">
            {repeated ? `${repeated.leakTag} x${repeated.count}` : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {copy.replay}
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-100" data-testid="coaching-recap-replays">
            {recap.replayRevisitCount}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {lessons.map((lesson) => (
          <article
            key={`${lesson.sessionId}-${lesson.lessonId}`}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3"
            data-testid="coaching-recap-lesson"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-100">
                    {lesson.severity}
                  </span>
                  <span
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200"
                    data-testid="coaching-recap-variant-badge"
                  >
                    {lesson.variantId ?? "unknownVariant"}
                  </span>
                </div>
                <h4 className="mt-1 text-sm font-semibold text-white">
                  {locale === "en" ? lesson.titleEn ?? lesson.lessonTag : lesson.titleJp ?? lesson.lessonTag}
                </h4>
              </div>
              <span className="text-xs font-semibold text-emerald-100">{formatEv(lesson.evDelta)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  onReplay?.({
                    lessonId: lesson.lessonId,
                    replayRef: lesson.replayRef,
                    href: lesson.replayUrl,
                    deterministic: lesson.replayDeterministic === true,
                  })
                }
                className="rounded-full border border-yellow-200/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100 hover:bg-yellow-200/10"
                data-testid="coaching-recap-replay"
                aria-label="Open lesson replay from recap"
              >
                {copy.replayCta}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {copy.next}
        </p>
        <p className="mt-1 text-sm text-slate-100" data-testid="coaching-recap-next">
          {recap.primaryRecommendation}
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onClearHistory?.()}
          className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:bg-white/10"
          data-testid="coaching-recap-clear"
          aria-label="Clear preview coaching history"
        >
          {copy.clear}
        </button>
      </div>
    </section>
  );
}
