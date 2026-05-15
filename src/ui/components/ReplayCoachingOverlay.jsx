import React, { useState } from "react";

function formatEv(value = 0) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

function titleForTag(tag = "") {
  if (tag === "missed-value") return "Missed Value";
  return String(tag || "Coaching").replace(/-/g, " ");
}

export default function ReplayCoachingOverlay({
  annotation,
  locale = "jp",
  onAcknowledged,
  onHelpful,
  onNotHelpful,
  onDismissed,
}) {
  const [closed, setClosed] = useState(false);
  if (!annotation || closed) return null;
  const text = locale === "en" ? annotation.en : annotation.jp;
  const close = () => {
    onDismissed?.(annotation);
    setClosed(true);
  };
  return (
    <aside
      className="pointer-events-auto rounded-2xl border border-yellow-300/35 bg-black/75 px-4 py-3 text-sm text-yellow-50 shadow-lg shadow-black/30"
      data-testid="replay-coaching-overlay"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-200">
            {titleForTag(annotation.lessonTag)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border border-yellow-200/40 bg-yellow-300/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              data-testid="replay-coaching-severity"
            >
              {annotation.severity}
            </span>
            <span
              className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100"
              data-testid="replay-coaching-ev"
            >
              EV {formatEv(annotation.evDelta)}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close coaching annotation"
          className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          onClick={close}
          data-testid="replay-coaching-close"
        >
          x
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-100" data-testid="replay-coaching-copy">
        {text}
      </p>
      <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
        {annotation.baselineAction}
        {" -> "}
        <span className="text-yellow-100">{annotation.highlightAction}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-emerald-200/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-200/10"
          onClick={() => onAcknowledged?.(annotation)}
          data-testid="replay-coaching-ack"
          aria-label="Acknowledge replay coaching lesson"
        >
          Got it
        </button>
        <button
          type="button"
          className="rounded-full border border-yellow-200/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100 hover:bg-yellow-200/10"
          onClick={() => onHelpful?.(annotation)}
          data-testid="replay-coaching-helpful"
          aria-label="Mark replay coaching lesson helpful"
        >
          Helpful
        </button>
        <button
          type="button"
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 hover:bg-white/10"
          onClick={() => onNotHelpful?.(annotation)}
          data-testid="replay-coaching-not-helpful"
          aria-label="Mark replay coaching lesson not helpful"
        >
          Not helpful
        </button>
      </div>
    </aside>
  );
}
