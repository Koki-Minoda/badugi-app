import React from "react";

export default function TournamentEliminatedRail({
  entries = [],
  layoutMode = "desktop",
}) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const isMobile = layoutMode === "mobile";
  return (
    <section
      data-testid="tournament-eliminated-rail"
      className={`rounded-2xl border border-white/10 bg-slate-950/70 shadow-lg ${
        isMobile ? "px-2 py-1" : "px-3 py-2"
      }`}
      aria-label="Eliminated players"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`${isMobile ? "text-[9px]" : "text-[10px]"} font-black uppercase tracking-wide text-slate-400`}>
          Rail
        </p>
        <p className={`${isMobile ? "text-[9px]" : "text-[10px]"} font-semibold text-slate-500`}>
          {entries.length}
        </p>
      </div>
      <div className={`mt-1 flex ${isMobile ? "gap-1 overflow-hidden" : "flex-wrap gap-1.5"}`}>
        {entries.map((entry) => (
          <span
            key={entry.id}
            data-testid={`eliminated-rail-entry-${entry.id}`}
            className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-slate-600/60 bg-slate-900/90 px-2 py-0.5 font-black uppercase text-slate-200 ${
              isMobile ? "text-[8px]" : "text-[10px]"
            }`}
            title={`${entry.name} ${entry.status ?? "OUT"}`}
          >
            <span className="truncate">{entry.name}</span>
            <span className="shrink-0 text-rose-200">{entry.status ?? "OUT"}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
