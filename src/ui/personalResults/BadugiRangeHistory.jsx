import React from 'react';
import { RangeComparisonResults } from '../tools/BadugiRangeComparison.jsx';
import { rangeAssumptionName } from '../tools/badugiRangePresets.js';
import { cardText } from '../tools/cardText.js';

export default function BadugiRangeHistory({ entries, onReplay, ja }) {
  if (!entries.length) return null;
  return <section className="space-y-3 rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-4">
    <h2 className="font-bold">{ja ? '保存したレンジ比較' : 'Saved range comparisons'}</h2>
    {entries.map(entry => (
      <details className="rounded-xl border border-white/15 px-3" key={`${entry.handId}:${entry.actionSeq}`}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-emerald-100">
          {ja ? `${4 - entry.remainingDraws}回目のドロー` : `Draw ${4 - entry.remainingDraws}`} · {new Date(entry.at).toLocaleDateString(ja ? 'ja-JP' : 'en-US')}
        </summary>
        <div className="space-y-3 pb-3">
          <p className="text-xs text-slate-300">{entry.observedCount == null
            ? (ja ? `相手の交換 ${entry.count}枚と仮定` : `Assumed opponent draw of ${entry.count}`)
            : (ja ? `観測した相手の交換 ${entry.count}枚` : `Observed opponent draw of ${entry.count}`)}{entry.deadCards?.length > 0 && <span>
              {' · '}{ja ? '除外カード' : 'Dead cards'} {entry.deadCards.map(cardText).join(' ')}
            </span>}</p>
          {entry.note && <p className="whitespace-pre-wrap break-words text-sm">{entry.note}</p>}
          <RangeComparisonResults result={entry.result} assumptions={entry.assumptions} ja={ja} />
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? '保存した候補手札と重み' : 'Saved hands and weights'}</summary>
            {entry.assumptions.map(({ preset, text }, index) => <div className="pb-2" key={index}>
              <p className="text-xs text-slate-300">{['A', 'B'][index]} · {rangeAssumptionName(preset, ja)}</p>
              <pre className="whitespace-pre-wrap break-words text-xs">{text}</pre>
            </div>)}
          </details>
          {onReplay && <button type="button" className="min-h-11 rounded-lg border border-emerald-300/40 px-3 text-sm font-semibold text-emerald-200"
            onClick={() => onReplay(entry.handId, { handId: entry.handId, actionSeqStart: entry.actionSeq, actionSeqEnd: entry.actionSeq })}>
            {ja ? '元の局面を開く' : 'Open original decision'}
          </button>}
        </div>
      </details>
    ))}
  </section>;
}
