import React from "react";
import { buildShowdownToastItems } from "../utils/showdownResultToast.js";

function formatAmount(value) {
  const amount = Math.max(0, Number(value) || 0);
  return amount.toLocaleString("ja-JP");
}

export default function ShowdownResultToast({ visible, summary }) {
  const items = buildShowdownToastItems(summary);
  if (!visible || !summary || items.length === 0) return null;
  const total = summary?.pot ?? items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  return (
    <div
      data-testid="showdown-result-toast"
      className="pointer-events-none fixed left-1/2 top-24 z-50 w-[min(760px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-emerald-200/50 bg-slate-950/92 px-4 py-3 text-white shadow-2xl backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">
            Showdown Result
          </p>
          <p className="text-lg font-black text-white">Total Pot {formatAmount(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-white/10 bg-white/8 px-3 py-2">
              <span className="mr-2 font-black uppercase text-yellow-200">{item.label}</span>
              <span className="font-semibold text-white">{item.winners}</span>
              <span className="ml-2 text-emerald-200">{formatAmount(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
