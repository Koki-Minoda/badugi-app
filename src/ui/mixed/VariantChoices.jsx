import React from 'react';

export default function VariantChoices({ label, options, ids, onChange, ja, emptyLabel }) {
  const known = new Set(options.map(option => option.id));
  const choices = [...options, ...ids.filter(id => !known.has(id)).map(id => ({ id, name: `${ja ? '未登録の種目' : 'Unknown game'} (${id})` }))];
  const names = ids.map(id => choices.find(option => option.id === id)?.name ?? id);
  const summary = names.slice(0, 2).join(' / ') + (names.length > 2 ? (ja ? ` ほか${names.length - 2}種目` : ` +${names.length - 2} more`) : '');
  return <details className="rounded-xl border border-white/15 p-3">
    <summary className="min-h-11 cursor-pointer break-words text-sm text-emerald-200">{label} · {summary || emptyLabel || (ja ? '指定なし' : 'None')}</summary>
    <div role="group" aria-label={label} className="mt-2 grid max-h-64 gap-1 overflow-y-auto">
      {choices.map(option => <label key={option.id} className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={ids.includes(option.id)} onChange={event => onChange(event.target.checked ? [...ids, option.id] : ids.filter(id => id !== option.id))} />
        {option.name}
      </label>)}
    </div>
  </details>;
}
