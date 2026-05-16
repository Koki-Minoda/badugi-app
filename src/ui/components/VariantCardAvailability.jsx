import React from "react";

const TONE_CLASSES = {
  alpha_playable: "border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
  preview_only: "border-amber-300/40 bg-amber-500/15 text-amber-100",
  coming_soon: "border-slate-300/25 bg-slate-700/40 text-slate-200",
  hidden: "border-slate-500/20 bg-slate-900/60 text-slate-400",
};

export default function VariantCardAvailability({
  availability,
  language = "en",
  compact = false,
}) {
  if (!availability) return null;
  const label =
    language === "ja"
      ? availability.statusLabelJa ?? availability.statusLabel
      : availability.statusLabel;
  return (
    <div className={compact ? "space-y-1" : "space-y-2"} data-testid="variant-availability">
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
          TONE_CLASSES[availability.availability] ?? TONE_CLASSES.coming_soon
        }`}
        data-testid="variant-availability-badge"
      >
        {label}
      </span>
      {!compact && availability.reason ? (
        <p
          className="text-xs leading-relaxed text-slate-300"
          title={availability.reason}
          data-testid="variant-availability-reason"
        >
          {availability.reason}
        </p>
      ) : null}
    </div>
  );
}

