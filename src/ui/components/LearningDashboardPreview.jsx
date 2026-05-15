import React from "react";

function formatNumber(value = 0) {
  return Number(value ?? 0).toFixed(1);
}

function collectVariants(data) {
  return Object.keys(data?.byVariant ?? {}).sort();
}

function mapChartPoints(points = [], width = 280, height = 90) {
  if (!points.length) return [];
  const maxY = Math.max(1, ...points.map((point) => Number(point.y ?? 0)));
  const step = points.length > 1 ? width / (points.length - 1) : width;
  return points.map((point, index) => {
    const x = points.length > 1 ? index * step : width / 2;
    const y = height - (Number(point.y ?? 0) / maxY) * (height - 12) - 6;
    return { ...point, cx: Number(x.toFixed(1)), cy: Number(y.toFixed(1)) };
  });
}

function linePoints(points = []) {
  return mapChartPoints(points).map((point) => `${point.cx},${point.cy}`).join(" ");
}

function MiniLineChart({ actual = [], ev = [] }) {
  const actualPoints = linePoints(actual);
  const evPoints = linePoints(ev);
  const evMarkers = mapChartPoints(ev);
  return (
    <svg
      viewBox="0 0 280 100"
      role="img"
      aria-label="Learning trend chart"
      className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-black/30"
      data-testid="learning-dashboard-chart"
      preserveAspectRatio="none"
    >
      <line x1="0" y1="88" x2="280" y2="88" stroke="rgba(255,255,255,0.16)" />
      <polyline fill="none" stroke="rgb(148,163,184)" strokeWidth="3" points={actualPoints} data-testid="actual-result-line" />
      <polyline fill="none" stroke="rgb(250,204,21)" strokeWidth="3" points={evPoints} data-testid="ev-reviewed-line" />
      {evMarkers.map((point) => (
        <circle
          key={`${point.sessionId}-${point.x}-${point.y}`}
          cx={point.cx}
          cy={point.cy}
          r="3.5"
          fill="rgb(250,204,21)"
          stroke="rgb(0,0,0)"
          strokeWidth="1"
          data-testid="ev-reviewed-point"
        />
      ))}
    </svg>
  );
}

function scopeFor(data, selectedVariant) {
  if (selectedVariant === "all") return data?.global ?? { sessions: [], totals: {} };
  return data?.byVariant?.[selectedVariant] ?? { sessions: [], totals: {}, repeatedLeaks: [] };
}

function seriesFor(series, selectedVariant) {
  if (selectedVariant === "all") return series?.global ?? {};
  return series?.byVariant?.[selectedVariant] ?? {};
}

export default function LearningDashboardPreview({
  dashboard,
  chartSeries,
  replayQueue = { items: [] },
  selectedVariant = "all",
  onVariantChange,
  onReplay,
  onClear,
  locale = "jp",
}) {
  const variants = collectVariants(dashboard);
  const scope = scopeFor(dashboard, selectedVariant);
  const scopedSeries = seriesFor(chartSeries, selectedVariant);
  const queueItems = (replayQueue.items ?? [])
    .filter((item) => selectedVariant === "all" || item.variantId === selectedVariant)
    .slice(0, 4);
  const topLeak = scope.repeatedLeaks?.[0] ?? dashboard?.global?.repeatedLeaks?.[0] ?? null;
  const copy = locale === "en"
    ? {
        heading: "Learning dashboard",
        preview: "Preview only",
        actual: "Actual result",
        ev: "Reviewed EV",
        lessons: "Lessons",
        replays: "Replays",
        leak: "Top repeated leak",
        queue: "Replay revisit queue",
        empty: "No learning data yet.",
        replay: "View replay",
        clear: "Clear preview data",
        all: "All",
      }
    : {
        heading: "学習ダッシュボード",
        preview: "プレビューのみ",
        actual: "実収支",
        ev: "見直しEV",
        lessons: "レッスン",
        replays: "リプレイ",
        leak: "よく出る課題",
        queue: "見直すリプレイ",
        empty: "まだ学習データはありません。",
        replay: "リプレイを見る",
        clear: "プレビューデータを消す",
        all: "すべて",
      };

  if (!scope.sessions?.length) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/55 px-4 py-4 text-sm text-slate-200" data-testid="learning-dashboard-empty">
        {copy.empty}
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-yellow-300/35 bg-black/65 px-4 py-4 text-white shadow-lg shadow-black/25"
      data-testid="learning-dashboard-preview"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-200">{copy.preview}</p>
          <h3 className="mt-1 text-base font-semibold">{copy.heading}</h3>
        </div>
        <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          EV +{formatNumber(scope.totals?.evDeltaReviewed)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Learning dashboard variant filter">
        {[{ id: "all", label: copy.all }, ...variants.map((variant) => ({ id: variant, label: variant }))].map((variant) => (
          <button
            key={variant.id}
            type="button"
            role="tab"
            aria-selected={selectedVariant === variant.id}
            onClick={() => onVariantChange?.(variant.id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              selectedVariant === variant.id ? "border-yellow-200/60 bg-yellow-200/15 text-yellow-50" : "border-white/15 text-slate-300 hover:bg-white/10"
            }`}
            data-testid="learning-dashboard-variant-tab"
          >
            {variant.label}
          </button>
        ))}
      </div>

      <MiniLineChart actual={scopedSeries.actualResultCumulative} ev={scopedSeries.evReviewedCumulative} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [copy.actual, formatNumber(scope.totals?.actualDeltaPreview)],
          [copy.ev, `+${formatNumber(scope.totals?.evDeltaReviewed)}`],
          [copy.lessons, scope.totals?.lessonCount ?? 0],
          [copy.replays, scope.totals?.replayViewedCount ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
            <p className="mt-1 text-sm font-semibold text-yellow-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{copy.leak}</p>
        <p className="mt-1 text-sm font-semibold text-yellow-100" data-testid="learning-dashboard-top-leak">
          {topLeak ? `${topLeak.variantId ?? selectedVariant} ${topLeak.leakTag} x${topLeak.count}` : "-"}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{copy.queue}</p>
        {queueItems.map((item) => (
          <article key={item.lessonId} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3" data-testid="learning-dashboard-replay-queue-item">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                  {item.variantId}
                </span>
                <p className="mt-1 text-sm font-semibold">{item.lessonTag}</p>
              </div>
              <button
                type="button"
                onClick={() => onReplay?.(item)}
                className="rounded-full border border-yellow-200/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-100 hover:bg-yellow-200/10"
                data-testid="learning-dashboard-replay"
              >
                {copy.replay}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onClear?.()}
          className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:bg-white/10"
          data-testid="learning-dashboard-clear"
        >
          {copy.clear}
        </button>
      </div>
    </section>
  );
}
