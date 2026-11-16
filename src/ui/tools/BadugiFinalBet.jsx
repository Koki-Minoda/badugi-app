import React, { useMemo, useState } from 'react';
import { getReviewUserId, saveBadugiReview } from '../personalResults/badugiReplayReview.js';
import { cardText } from './cardText.js';
import { useBadugiCalculation } from './useBadugiCalculation.js';

const field = 'mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-slate-800 p-2 text-base text-white';
const action = 'min-h-11 rounded-lg border border-emerald-300/50 px-3 py-2 text-sm text-emerald-100';
const rankNames = ['—', 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

function move(cards, ja) {
  return cards.length ? (ja ? `${cards.map(cardText).join(' ')} を交換` : `Draw for ${cards.map(cardText).join(' ')}`) : (ja ? 'パット' : 'Stand pat');
}

export default function BadugiFinalBet({ base, opponentCount, spot, ja }) {
  const [open, setOpen] = useState(false);
  const [pot, setPot] = useState(spot?.pot > 0 ? String(spot.pot) : '');
  const [bet, setBet] = useState('');
  const [lead, setLead] = useState(10);
  const [call, setCall] = useState(12);
  const [saved, setSaved] = useState(null);
  const settings = useMemo(() => ({ pot: Number(pot), bet: Number(bet), lead, call }), [pot, bet, lead, call]);
  const eligible = base && (base.remainingDraws === 0 || (base.opponentDiscards ?? []).length <= 1 && [0, 1, 5].includes(opponentCount));
  const request = useMemo(() => open && eligible && settings.pot > 0 && settings.bet > 0
    ? { ...base, opponentCount, settings }
    : null, [open, eligible, base, opponentCount, settings]);
  const { current, retry } = useBadugiCalculation(request);
  const { actions, error } = current?.data ?? {};
  const best = actions?.filter(action => Number.isFinite(action.ev)).reduce((winner, next) => !winner || next.ev > winner.ev ? next : winner, null);
  const actual = spot?.actualDiscards && actions?.find(({ cards }) =>
    cards.length === spot.actualDiscards.length && cards.every(card => spot.actualDiscards.includes(card)));
  const terminal = base?.remainingDraws === 0 ? actions?.[0]?.terminal : null;
  const userId = getReviewUserId();
  const canSave = userId != null && spot?.actionSeq != null && request?.remainingDraws === 1 && actual && actions.every(action => Number.isFinite(action.ev))
    && settings.bet <= spot.effectiveStack && settings.pot === spot.pot && request.rangeText != null
    && (spot.observedCount == null || spot.observedCount === opponentCount);
  const value = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { maximumFractionDigits: 3 });
  const pct = probability => new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(probability);
  const displayValue = chips => Number.isFinite(chips) ? value.format(chips) : '—';

  return (
    <details className="rounded-2xl border border-emerald-300/30 bg-slate-900 p-4" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-lg font-bold text-emerald-200">{ja ? '最終ベット込みのEVを比べる' : 'Compare EV with final betting'}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-300">{ja
          ? '相手が先に行動する固定リミットのモデルです。最大1ベットで、レイズはありません。相手のベットを受けたら自分はコールかフォールド、チェックを受けたらベットかチェックを選びます。'
          : 'This fixed-limit model puts the opponent first, with one bet and no raises. Face a lead by calling or folding, or respond to a check by betting or checking back.'}</p>
        {(!eligible || base.remainingDraws === 1) && <p className="text-sm text-slate-300">{ja
          ? '3rdではパットと各1枚交換を比較します。相手も0〜1枚交換で指定してください。'
          : 'On the third draw, compare standing pat and each single-card discard. Choose zero or one opponent discard.'}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-sm">{ja ? '現在のポット（チップ）' : 'Current pot (chips)'}<input className={field} type="number" inputMode="decimal" min="0" value={pot} onChange={event => setPot(event.target.value)} /></label>
          <label className="text-sm">{ja ? '1ベットの額（チップ）' : 'Bet size (chips)'}<input className={field} type="number" inputMode="decimal" min="0" value={bet} onChange={event => setBet(event.target.value)} /></label>
          <label className="text-sm">{ja ? '相手が先にベットする手' : 'Opponent leads with'}<select className={field} value={lead} onChange={event => setLead(Number(event.target.value))}>
            <option value={0}>{ja ? '常にチェック' : 'Always check'}</option>
            {rankNames.slice(4).map((rank, index) => <option key={rank} value={index + 4}>{ja ? `${rank}以下のBadugi` : `${rank}-high Badugi or better`}</option>)}
          </select></label>
          <label className="text-sm">{ja ? '相手がチェック後にコールする手' : 'Opponent check-calls with'}<select className={field} value={call} onChange={event => setCall(Number(event.target.value))}>
            <option value={0}>{ja ? '常にフォールド' : 'Always fold'}</option>
            {rankNames.slice(4).map((rank, index) => <option key={rank} value={index + 4}>{ja ? `${rank}以下のBadugi` : `${rank}-high Badugi or better`}</option>)}
          </select></label>
        </div>
        {request && !current && <p role="status" className="text-sm">{ja ? 'EVを計算中…' : 'Calculating EV…'}</p>}
        {current?.failed && <button type="button" className={action} onClick={retry}>{ja ? '計算に失敗しました。再計算する' : 'Calculation failed. Retry'}</button>}
        {error && <p role="status" className="text-sm text-amber-100">{ja ? '手札・レンジ・ベット条件を確認してください。' : 'Check the hands, range, and bet settings.'}</p>}
        {actions && base?.remainingDraws === 1 && (
          <table className="w-full text-left text-sm tabular-nums">
            <thead><tr><th scope="col" className="py-2">{ja ? '交換' : 'Draw'}</th><th scope="col" className="text-right">EV</th><th scope="col" className="text-right">{ja ? '最良候補との差' : 'Gap to best'}</th></tr></thead>
            <tbody>{actions.map(entry => {
              const played = entry === actual;
              return <tr key={entry.cards.join(',')} className="border-t border-white/15">
                <th scope="row" className="py-2 font-medium">{move(entry.cards, ja)}{played && <span className="ml-2 text-xs text-emerald-200">{ja ? '実際の選択' : 'Played'}</span>}</th>
                <td className="text-right">{displayValue(entry.ev)}</td>
                <td className="text-right">{displayValue(best?.ev - entry.ev)}</td>
              </tr>;
            })}</tbody>
          </table>
        )}
        {terminal && (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {terminal.leadWeight > 0 && <p>{ja ? '相手のベットを受けた場合' : 'Facing a lead'}（{pct(terminal.leadWeight)}）<br />{ja ? 'フォールド' : 'Fold'} 0 · {ja ? 'コール' : 'Call'} {displayValue(terminal.call / terminal.leadWeight)}</p>}
            {terminal.checkWeight > 0 && <p>{ja ? '相手のチェックを受けた場合' : 'Facing a check'}（{pct(terminal.checkWeight)}）<br />{ja ? 'チェック' : 'Check'} {displayValue(terminal.check / terminal.checkWeight)} · {ja ? 'ベット' : 'Bet'} {displayValue(terminal.bet / terminal.checkWeight)}</p>}
          </div>
        )}
        {actions && <p className="text-xs text-slate-300">{ja
          ? 'EVは判断時点からの期待チップです。3rdでは、引いた後の自分の手札と相手のベット／チェックを見て応じる前提です。'
          : 'EV is expected chips from the decision. After drawing, your response uses your final hand and the observed lead or check.'}</p>}
        {canSave && <button type="button" className={action} onClick={() => setSaved({ request, ok: saveBadugiReview(userId, spot, settings, actions, { opponentCount, opponentDiscards: request.opponentDiscards, rangeText: request.rangeText }) })}>
          {ja ? 'この判断をマイ結果に保存' : 'Save this decision to My results'}
        </button>}
        {saved?.request === request && <p role="status" className="text-sm">{saved.ok
          ? (ja ? 'マイ結果に保存しました。' : 'Saved to My results.')
          : (ja ? 'この端末に保存できませんでした。' : 'Could not save on this device.')}</p>}
      </div>
    </details>
  );
}
