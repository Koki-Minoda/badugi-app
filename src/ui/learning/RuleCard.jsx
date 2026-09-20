import React from 'react';
import { getLearningGame, getRuleRows } from './learningCatalog.js';
export default function RuleCard({ variantId, previousId, language = 'ja' }) {
  const game = getLearningGame(variantId);
  if (!game) return null;
  const previous = getLearningGame(previousId);
  const ja = language === 'ja';
  return <section aria-label={ja ? '種目のルール' : 'Game rules'} className="space-y-3">
    <h2 className="text-lg font-bold">{previous && previous.id !== game.id ? `${previous.name} → ` : ''}{game.name}</h2>
    <dl className="space-y-3">{getRuleRows(variantId, language, previousId).map(row => <div key={row.key} className={`rounded-xl border p-3 ${row.changed ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/15 bg-white/5'}`}>
      <dt className="mb-1 text-sm font-semibold">{row.changed ? (ja ? '変更点 · ' : 'Changed · ') : ''}{row.label}</dt>
      <dd className="text-sm leading-relaxed text-slate-200">{row.value}</dd>
      {row.changed && <dd className="mt-2 text-xs text-slate-400">{ja ? '前の種目：' : 'Previously: '}{row.previous}</dd>}
    </div>)}</dl>
  </section>;
}
