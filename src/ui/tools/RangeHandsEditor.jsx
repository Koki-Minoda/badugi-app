import React from 'react';

export default function RangeHandsEditor({ name, text, onChange, ja }) {
  const lines = text.split(/\r?\n/).filter(line => line.trim()).length;
  const helpId = `range-${name}-help`;
  return <details className="rounded-lg border border-white/15 px-3" data-testid={`range-${name}-editor`}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm text-emerald-200">
      {ja ? `レンジ${name}の手札・重みを編集` : `Edit Range ${name} hands and weights`} · {lines ? (ja ? `入力${lines}行` : `${lines} input rows`) : (ja ? '未入力' : 'Empty')}
    </summary>
    <label className="grid gap-1 text-sm font-medium">
      {ja ? `レンジ${name}の手札と重み` : `Range ${name} hands and weights`}
      <textarea className="mb-3 min-h-28 w-full rounded-lg border border-white/20 bg-slate-800 p-3 font-mono text-base" spellCheck={false}
        value={text} maxLength={4000} placeholder={'9S 7C 5D 4H 3\n8S 6C 4D 2H 1'} aria-describedby={helpId}
        onChange={event => onChange({ preset: null, text: event.target.value })} />
    </label>
    <p id={helpId} className="pb-3 text-xs text-slate-300">{ja
      ? '1行に4枚と重みを入力します（例 9S 7C 5D 4H 3）。重み省略は1。最大24行です。観測した交換枚数などを考慮した重みを入力してください。'
      : 'Use one line per candidate with four cards and a weight, e.g. 9S 7C 5D 4H 3. Weight defaults to 1. Up to 24 lines. Enter weights that account for observed actions.'}</p>
  </details>;
}
