import React from "react";

export default function OpponentCard({ opponent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-300">{opponent.tier}</p>
          <h3 className="text-xl font-bold text-white">{opponent.name}</h3>
        </div>
        <div className="text-right text-sm text-slate-300">
          <div>★{opponent.strength}</div>
          <div>{opponent.style}</div>
        </div>
      </div>
      <p className="text-slate-300 text-sm mb-3">{opponent.trait}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-200">
        <div>
          <dt className="text-slate-400">Aggression</dt>
          <dd>{(opponent.aggr * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-slate-400">Tightness</dt>
          <dd>{(opponent.tight * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-slate-400">Draw Rate</dt>
          <dd>{(opponent.drawRate * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-slate-400">Bluff</dt>
          <dd>{(opponent.bluffFreq * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-slate-400">{opponent.notes}</p>
    </div>
  );
}
