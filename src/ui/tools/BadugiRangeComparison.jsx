import React, { useMemo, useState } from 'react';
import { getReviewUserId } from '../personalResults/badugiReplayReview.js';
import { saveBadugiRangeComparison } from '../personalResults/badugiRangeReviewStore.js';
import { orderedRangePresets, rangeAssumptionName } from './badugiRangePresets.js';
import { cardText } from './cardText.js';
import { useBadugiCalculation } from './useBadugiCalculation.js';

const button = 'min-h-11 rounded-lg border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50';
const field = 'block min-h-11 w-full rounded-lg border border-white/20 bg-slate-800 p-2 text-base text-white';

function actionText(id, ja) {
  return id === 'pat' ? (ja ? 'パット' : 'Stand pat') : (ja ? `${cardText(id)} を切る` : `Discard ${cardText(id)}`);
}

export function RangePresetField({ label, value, presets, count, onChange, ja }) {
  const ordered = orderedRangePresets(count);
  return <label className="grid gap-1 text-sm">{label}
    <select className={field} value={value ?? ''} disabled={!presets} onChange={event => {
      const id = event.target.value;
      if (id) onChange({ preset: id, text: presets[id].text });
    }}>
      <option value="" disabled>{ja ? '候補を選ぶ' : 'Choose a preset'}</option>
      {ordered.map(preset => <option key={preset.id} value={preset.id} disabled={!presets?.[preset.id]}>
        {preset.label[ja ? 0 : 1]}{preset.draw === count ? (ja ? ' · 交換枚数に対応' : ' · Matches draw count') : ''}
      </option>)}
    </select>
  </label>;
}

export function RangeComparisonResults({ result, assumptions, ja }) {
  const percent = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { style: 'percent', maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { signDisplay: 'exceptZero', maximumFractionDigits: 1 });
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      {result.endpoints.map((endpoint, index) => (
        <div className="rounded-lg bg-slate-950 p-3 text-sm" key={index}>
          <p className="font-semibold">{['A', 'B'][index]} · {rangeAssumptionName(assumptions[index].preset, ja)}</p>
          <p className="text-emerald-200">{endpoint.clear ? actionText(endpoint.id, ja) : (ja ? '最良候補は僅差' : 'Leaders are close')}</p>
          <p className="text-xs text-slate-300">{ja
            ? `有効 ${result.ranges[index].hands}組 · 除外 ${result.ranges[index].excluded}件`
            : `${result.ranges[index].hands} valid · ${result.ranges[index].excluded} blocked`}</p>
        </div>
      ))}
    </div>
    <table className="w-full text-left text-sm tabular-nums">
      <thead className="text-slate-300"><tr>
        <th scope="col" className="py-2">{ja ? '自分の選択' : 'Your action'}</th>
        <th scope="col" className="text-right">{ja ? 'Aの取り分' : 'A equity'}</th>
        <th scope="col" className="text-right">{ja ? 'Bの取り分' : 'B equity'}</th>
        <th scope="col" className="text-right">B − A</th>
      </tr></thead>
      <tbody>{result.actions.map(action => <tr key={action.id} className="border-t border-white/15">
        <th scope="row" className="py-2 font-medium">{actionText(action.id, ja)}</th>
        <td className="text-right">{action.approximate && '≈'}{percent.format(action.a)}</td>
        <td className="text-right">{action.approximate && '≈'}{percent.format(action.b)}</td>
        <td className="text-right">{signed.format((action.b - action.a) * 100)} {ja ? 'pt' : 'pp'}</td>
      </tr>)}</tbody>
    </table>
    {result.transitions.length > 0 && <ul className="space-y-1 rounded-lg border border-emerald-300/30 p-3 text-sm text-emerald-100">
      {result.transitions.map(({ from, to, weight }) => <li key={`${from}:${to}`}>
        {ja
          ? `既知カードを除いたAとBを混ぜると、Bの比率が約${percent.format(weight)}で ${actionText(from, ja)} → ${actionText(to, ja)} に変わります。`
          : `At about ${percent.format(weight)} B in an A/B mixture, the leader changes from ${actionText(from, ja)} to ${actionText(to, ja)}.`}
      </li>)}
    </ul>}
    <p className="text-xs text-slate-300">{ja
      ? '相手の交換枚数は共通です。取り分はショーダウンに進む前提で計算します。'
      : 'The opponent draws the same count in both ranges. Equity assumes showdown.'}
    {result.approximate && (ja ? ' 推定結果の最良候補は2ポイント以内を僅差としました。' : ' For estimates, a lead within two points is shown as close.')}</p>
  </div>;
}

export default function BadugiRangeComparison({ base, assumptions, onAlternate, count, presets, spot, saved, errors, ja }) {
  const [submitted, setSubmitted] = useState(null);
  const [note, setNote] = useState(saved?.note ?? '');
  const [saveState, setSaveState] = useState(null);
  const [primary, alternate] = assumptions;
  const comparison = useMemo(() => base && count >= 0 && primary.text.trim() && alternate.text.trim()
    ? { base, assumptions: [primary, alternate], ranges: [primary.text, alternate.text], count }
    : null, [base, primary, alternate, count]);
  const request = useMemo(() => comparison && submitted === comparison ? { comparison } : null, [comparison, submitted]);
  const { current, retry } = useBadugiCalculation(request);
  const result = current?.data;
  const userId = getReviewUserId();
  const canSave = userId != null && spot?.actionSeq != null && (spot.observedCount == null || spot.observedCount === count);

  return <section aria-labelledby="range-comparison-title" className="space-y-3 rounded-2xl border border-emerald-300/35 bg-slate-900 p-4 sm:p-5">
    <h3 id="range-comparison-title" className="text-lg font-bold">{ja ? '2つのレンジで判断を比べる' : 'Compare decisions across two ranges'}</h3>
    <p className="text-sm text-slate-300">{ja
      ? '上で入力したレンジをAとして、Bには別の想定を入れます。パットと各1枚交換の取り分がどう変わるかを比較します。'
      : 'Use the range above as A and a second assumption as B. Compare showdown equity for standing pat and each single-card discard.'}</p>
    <RangePresetField label={ja ? 'レンジBの候補' : 'Range B preset'} value={alternate.preset} presets={presets} count={count} onChange={onAlternate} ja={ja} />
    <details className="rounded-lg border border-white/15 px-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-emerald-200">{ja ? 'レンジBの手札・重みを編集' : 'Edit Range B hands and weights'}</summary>
      <textarea className={`${field} mb-3 min-h-28 font-mono`} aria-label={ja ? 'レンジBの手札と重み' : 'Range B hands and weights'}
        maxLength={4000} value={alternate.text} spellCheck={false} onChange={event => onAlternate({ preset: null, text: event.target.value })} />
    </details>
    {count < 0 && <p className="text-sm text-slate-300">{ja ? '比較に使う相手の交換枚数を選んでください。' : 'Choose an opponent draw count to compare.'}</p>}
    <button type="button" className={button} disabled={!comparison || Boolean(request && !current)} onClick={() => setSubmitted(comparison)}>
      {ja ? 'レンジA・Bを比較' : 'Compare ranges A and B'}
    </button>
    {request && !current && <p role="status" className="text-sm">{ja ? '2つのレンジを計算中…' : 'Calculating both ranges…'}</p>}
    {current?.failed && <button type="button" className={button} onClick={retry}>{ja ? '比較を再計算' : 'Retry comparison'}</button>}
    {result?.error && <p role="status" className="text-sm text-amber-100">
      {result.profile != null && `${['A', 'B'][result.profile]} · `}
      {result.line != null && (ja ? `${result.line}行目 · ` : `Line ${result.line} · `)}
      {errors[result.error]?.[ja ? 0 : 1]}
    </p>}
    {result?.actions && <>
      <RangeComparisonResults result={result} assumptions={assumptions} ja={ja} />
      {canSave && <div className="space-y-2 border-t border-white/15 pt-3">
        <label className="grid gap-1 text-sm">{ja ? '見立てのメモ（任意）' : 'Range read note (optional)'}
          <input className={field} value={note} maxLength={300} onChange={event => setNote(event.target.value)} />
        </label>
        <button type="button" className={button} onClick={() => setSaveState({ request, note, ok: saveBadugiRangeComparison(userId, spot, comparison, result, note) })}>
          {ja ? '前提と比較結果をマイ結果に保存' : 'Save the assumptions and comparison to My Results'}
        </button>
        {saveState?.request === request && saveState.note === note && <p role="status" className="text-sm">{saveState.ok
          ? (ja ? 'レンジ比較を保存しました。' : 'Range comparison saved.')
          : (ja ? 'この端末に保存できませんでした。' : 'Could not save on this device.')}</p>}
      </div>}
    </>}
  </section>;
}
