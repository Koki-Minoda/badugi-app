import React from 'react';
import { cardText } from './cardText.js';

function Showdown({ result, players, actions, ja }) {
  const locale = ja ? 'ja-JP' : 'en-US';
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat(locale);
  const stats = [
    ['wins', ja ? '勝ち' : 'Win'],
    ['ties', ja ? '引き分け' : 'Tie'],
    ['losses', ja ? '負け' : 'Loss'],
  ];

  return (
    <section aria-labelledby="equity-results" className="space-y-4 rounded-2xl border border-emerald-300/40 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="equity-results" className="text-lg font-bold">{ja ? 'ショーダウン結果' : 'Showdown result'}</h3>
        <p className="text-xs text-slate-300">
          {result.range && result.method === 'simulation'
            ? (ja ? '候補の重みを反映した推定値' : 'Weighted range estimate')
            : result.method === 'simulation'
            ? (ja ? `${integer.format(result.outcomes)} 回の試行・推定値` : `${integer.format(result.outcomes)} simulated deals`)
            : (ja ? `${integer.format(result.outcomes)} 通りを全列挙` : `${integer.format(result.outcomes)} exact outcomes`)}
          <span className="mx-2" aria-hidden="true">·</span>
          {ja ? `山札 ${integer.format(result.availableCards)} 枚` : `${integer.format(result.availableCards)} cards available`}
        </p>
      </div>
      {actions && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
          {actions.map((cards, seat) => <span key={seat}>{players[seat]} · {typeof cards === 'string' ? cards : actionName(cards, ja)}</span>)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2" aria-live="polite" aria-atomic="true">
        {result.players.map((player, seat) => (
          <div key={seat} className="min-w-0 rounded-xl bg-slate-950/60 p-3 sm:p-4">
            <p className="text-sm font-semibold">{players[seat]}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-4xl ${seat === 0 ? 'text-emerald-200' : 'text-white'}`}>
              {result.method === 'simulation' && '≈'}{percent.format(player.equity)}
            </p>
            <p className="mt-1 text-xs text-slate-300">{ja ? 'エクイティ' : 'Pot equity'}</p>
          </div>
        ))}
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-600" aria-hidden="true">
        <div className="bg-emerald-300" style={{ width: `${result.players[0].equity * 100}%` }} />
      </div>
      <table className="w-full table-fixed text-left text-sm tabular-nums">
        <thead className="text-slate-300">
          <tr>
            <th scope="col" className="py-2 font-medium">{ja ? '内訳' : 'Outcome'}</th>
            {players.map(player => <th key={player} scope="col" className="py-2 text-right font-medium">{player}</th>)}
          </tr>
        </thead>
        <tbody>
          {stats.map(([key, label]) => (
            <tr key={key} className="border-t border-white/15">
              <th scope="row" className="py-2 font-medium">{label}</th>
              {result.players.map((player, seat) => (
                <td key={seat} className="py-2 text-right">
                  {percent.format(result.range ? player[key] : player[key] / result.outcomes)} {!result.range && <span className="text-xs text-slate-300">({integer.format(player[key])})</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-slate-300">
        {ja ? 'エクイティは勝率＋引き分け率の半分です。交換に使う山札から、両者の元の手札と除外カードを除きます。' : 'Pot equity is win probability plus half the tie probability. The draw pile excludes both original hands and all dead cards.'}
      </p>
      {result.method === 'simulation' && <p className="text-xs text-slate-300">
        {ja ? '試行による誤差の目安は各エクイティで最大約±1ポイント（95%）です。' : 'Approximate 95% sampling margin for each equity: up to ±1 percentage point.'}
      </p>}
    </section>
  );
}

function actionName(cards, ja) {
  return cards.length ? cards.map(cardText).join(' ') : (ja ? 'パット' : 'Stand pat');
}

function ComparisonOptions({ options, selected, onChoose, ja }) {
  const percent = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { style: 'percent', maximumFractionDigits: 2 });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(({ id, label, value }) => (
        <button key={id} type="button" disabled={Boolean(value.error)} aria-pressed={id === selected} onClick={() => onChoose(id)} className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${id === selected ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100' : 'border-white/20'}`}>
          <span>{label}</span>
          <span className="font-bold tabular-nums">{value.error ? (ja ? '山札不足' : 'Deck too small') : `${value.method === 'simulation' ? '≈' : ''}${percent.format(value.players[0].equity)}`}</span>
        </button>
      ))}
    </div>
  );
}

export default function BadugiEquityResults({ result, columns, choices, hero, opponent, onHero, onOpponent, players, ja }) {
  const selectedColumn = columns[opponent];
  const heroOptions = selectedColumn ? choices.map((cards, id) => ({ id, cards, label: actionName(cards, ja), value: selectedColumn.results[id] })) : [];
  const opponentOptions = columns.slice(0, 5).map(({ cards, results }, id) => ({
    id,
    label: `${ja ? `${id}枚` : `${id} ${id === 1 ? 'card' : 'cards'}`}${cards ? ` · ${actionName(cards, ja)}` : ''}`,
    value: results[hero],
  }));
  const opponentAction = selectedColumn?.cards ?? (opponent >= 0 ? (ja ? `${opponent}枚交換` : `Draw ${opponent}`) : '');
  return (
    <>
      {result && !result.error && <Showdown result={result} players={players} actions={selectedColumn && [choices[hero], opponentAction]} ja={ja} />}
      {heroOptions.some(option => !option.value.error) && (
        <section aria-labelledby="equity-actions" className="space-y-3 rounded-2xl border border-white/20 p-4 sm:p-5">
          <h3 id="equity-actions" className="text-lg font-bold">{ja ? '自分が切るカードを比べる' : 'Compare your discards'}</h3>
          <p className="text-sm text-slate-300">{ja ? '相手の交換を固定したときの、自分のエクイティです。' : 'Your pot equity with the opponent’s choice held fixed.'}</p>
          <ComparisonOptions options={heroOptions.filter(({ cards }) => cards.length <= 1)} selected={hero} onChoose={onHero} ja={ja} />
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm text-emerald-200">{ja ? '2〜4枚交換の比較' : 'Compare two to four discards'}</summary>
            <ComparisonOptions options={heroOptions.filter(({ cards }) => cards.length > 1).sort((a, b) => a.cards.length - b.cards.length)} selected={hero} onChoose={onHero} ja={ja} />
          </details>
        </section>
      )}
      {opponentOptions.some(option => !option.value.error) && (
        <section aria-labelledby="equity-opponent" className="space-y-3 rounded-2xl border border-white/20 p-4 sm:p-5">
          <h3 id="equity-opponent" className="text-lg font-bold">{ja ? '相手の交換枚数を比べる' : 'Compare opponent draw counts'}</h3>
          <p className="text-sm text-slate-300">{ja ? '自分の交換を固定したときのエクイティです。枚数を選ぶと、自分が切るカードの比較が表示されます。' : 'Your equity with your draw held fixed. Select a count to compare your discard choices.'}</p>
          <ComparisonOptions options={opponentOptions} selected={opponent} onChoose={onOpponent} ja={ja} />
        </section>
      )}
    </>
  );
}
