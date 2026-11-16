import React, { useMemo, useState } from 'react';
import CardPicker from './CardPicker.jsx';
import { calculateBadugiEquity } from './badugiEquity.js';
import { cardText } from './cardText.js';

const example = {
  hands: [['AC', '2D', '3H', 'KH'], ['9S', '7C', '5D', '4H']],
  remainingDraws: 1,
  discards: ['KH', null],
  deadCards: [],
};

const errors = {
  handSize: ['自分と相手の手札を4枚ずつ選ぶと、ここに結果が表示されます。', 'Choose four cards for each player to see the result.'],
  card: ['カードの入力を確認してください。', 'Check the cards you entered.'],
  duplicate: ['同じカードが含まれています。手札と除外カードを確認してください。', 'A card appears more than once. Check the hands and dead cards.'],
  discard: ['交換するカードが手札にあるか確認してください。', 'Check that each discard is in its player’s hand.'],
  drawRounds: ['残りドローを0回か1回に設定してください。', 'Choose zero or one remaining draw round.'],
  deckTooSmall: ['交換に必要なカードが山札に残っていません。除外カードを減らすか、交換する人数を減らしてください。', 'There are too few cards left to complete the draw. Remove dead cards or have fewer players draw.'],
};

const selectClass = 'min-h-11 min-w-0 rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-base text-white';

function actionText(card, ja) {
  if (card === null) return ja ? 'パット（交換なし）' : 'Stand pat';
  return ja ? `${cardText(card)} を交換` : `Draw for ${cardText(card)}`;
}

function EquityResults({ result, alternatives, selected, players, ja, onChoose }) {
  const locale = ja ? 'ja-JP' : 'en-US';
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat(locale);
  const stats = [
    ['wins', ja ? '勝ち' : 'Win'],
    ['ties', ja ? '引き分け' : 'Tie'],
    ['losses', ja ? '負け' : 'Loss'],
  ];

  return (
    <>
      {!result.error && (
        <section aria-labelledby="equity-results" className="space-y-4 rounded-2xl border border-emerald-300/40 bg-slate-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="equity-results" className="text-lg font-bold">{ja ? 'ショーダウン結果' : 'Showdown result'}</h3>
            <p className="text-xs text-slate-300">
              {ja ? `${integer.format(result.outcomes)} 通りを全列挙` : `${integer.format(result.outcomes)} exact outcomes`}
              <span className="mx-2" aria-hidden="true">·</span>
              {ja ? `山札 ${integer.format(result.availableCards)} 枚` : `${integer.format(result.availableCards)} cards available`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-live="polite" aria-atomic="true">
            {result.players.map((player, seat) => (
              <div key={seat} className="min-w-0 rounded-xl bg-slate-950/60 p-3 sm:p-4">
                <p className="text-sm font-semibold">{players[seat]}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-4xl ${seat === 0 ? 'text-emerald-200' : 'text-white'}`}>
                  {percent.format(player.equity)}
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
                      {percent.format(player[key] / result.outcomes)} <span className="text-xs text-slate-300">({integer.format(player[key])})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs leading-relaxed text-slate-300">
            {ja ? 'エクイティは勝率＋引き分け率の半分です。交換に使う山札から、両者の元の手札と除外カードを除きます。' : 'Pot equity is win probability plus half the tie probability. The draw pile excludes both original hands and all dead cards.'}
          </p>
        </section>
      )}
      {alternatives.length > 0 && (
        <section aria-labelledby="equity-actions" className="space-y-3 rounded-2xl border border-white/20 p-4 sm:p-5">
          <h3 id="equity-actions" className="text-lg font-bold">{ja ? '自分の交換を比べる' : 'Compare your draw choices'}</h3>
          <p className="text-sm text-slate-300">
            {ja ? '相手の交換と除外カードを固定したときの、自分のエクイティです。選ぶと結果の内訳を切り替えます。' : 'Your pot equity with the opponent’s choice and dead cards held fixed. Select a choice to see its breakdown.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {alternatives.map(({ card, value }) => (
              <button key={card ?? 'pat'} type="button" disabled={Boolean(value.error)} aria-pressed={card === selected} onClick={() => onChoose(card)} className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${card === selected ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100' : 'border-white/20'}`}>
                <span>{actionText(card, ja)}</span>
                <span className="font-bold tabular-nums">{value.error ? (ja ? '山札不足' : 'Deck too small') : percent.format(value.players[0].equity)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function BadugiEquityCalculator({ ja }) {
  const [scenario, setScenario] = useState(example);
  const { hands, remainingDraws, discards, deadCards } = scenario;
  const [heroDiscard, opponentDiscard] = discards;
  const players = ja ? ['自分', '相手'] : ['You', 'Opponent'];
  const canCompare = remainingDraws === 1 && hands.every(hand => hand.length === 4);
  const outcomes = useMemo(() => {
    const choices = canCompare ? [null, ...hands[0]] : [null];
    return choices.map(card => ({
      card,
      value: calculateBadugiEquity({ hands, remainingDraws, deadCards, discards: [card, opponentDiscard] }),
    }));
  }, [canCompare, hands, remainingDraws, deadCards, opponentDiscard]);
  const result = canCompare ? outcomes.find(({ card }) => card === heroDiscard).value : outcomes[0].value;
  const alternatives = canCompare && outcomes.some(({ value }) => !value.error) ? outcomes : [];

  const setDiscard = (seat, card) => setScenario(previous => ({
    ...previous,
    discards: previous.discards.map((value, index) => index === seat ? card : value),
  }));

  function setHand(seat, cards) {
    setScenario(previous => ({
      ...previous,
      hands: previous.hands.map((hand, index) => index === seat ? cards : hand),
      discards: previous.discards.map((card, index) => index === seat && !cards.includes(card) ? null : card),
    }));
  }

  return (
    <section aria-labelledby="badugi-equity-title" className="space-y-4">
      <header className="space-y-2">
        <h2 id="badugi-equity-title" className="text-xl font-bold sm:text-2xl">{ja ? 'Badugi エクイティ計算機' : 'Badugi equity calculator'}</h2>
        <p className="max-w-2xl text-sm text-slate-300">
          {ja ? '2人の手札が分かる局面で、ショーダウンの勝率とポットの取り分を計算します。最後のドローでパットと1枚交換を比べられます。' : 'Calculate showdown odds and pot equity for two known hands. Compare standing pat with drawing one card in the final round.'}
        </p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          {ja ? '残りドロー' : 'Remaining draws'}
          <select className={selectClass} value={remainingDraws} onChange={event => {
            const rounds = Number(event.target.value);
            setScenario(previous => ({ ...previous, remainingDraws: rounds, discards: [null, null] }));
          }}>
            <option value={0}>{ja ? '0回（ショーダウン）' : '0 (showdown)'}</option>
            <option value={1}>{ja ? '1回（最終ドロー）' : '1 (final draw)'}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3 text-emerald-200" onClick={() => setScenario(example)}>{ja ? '入力例を使う' : 'Load example'}</button>
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => setScenario({ hands: [[], []], remainingDraws, discards: [null, null], deadCards: [] })}>{ja ? 'カードをクリア' : 'Clear cards'}</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {hands.map((cards, seat) => (
          <CardPicker key={seat} bySuit cards={cards} count={4} blocked={[...hands[1 - seat], ...deadCards]} label={players[seat]} ja={ja} onChange={value => setHand(seat, value)}>
            {remainingDraws === 1 && (
              <label className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-3 text-sm font-medium">
                {ja ? '交換' : 'Draw choice'}
                <select className={selectClass} value={discards[seat] ?? ''} onChange={event => setDiscard(seat, event.target.value || null)}>
                  <option value="">{actionText(null, ja)}</option>
                  {cards.map(card => <option key={card} value={card}>{actionText(card, ja)}</option>)}
                </select>
              </label>
            )}
          </CardPicker>
        ))}
      </div>
      <details className="rounded-xl border border-white/20 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-emerald-200">
          {ja ? `除外カード（任意・${deadCards.length}枚）` : `Dead cards (optional, ${deadCards.length})`}
        </summary>
        <div className="space-y-2 pb-3">
          <p className="text-sm text-slate-300">{ja ? 'すでに卓外にあると分かっているカードを指定します。' : 'Select known cards that are out of play.'}</p>
          <CardPicker bySuit cards={deadCards} blocked={hands.flat()} label={ja ? '除外カード' : 'Dead cards'} ja={ja} onChange={value => setScenario(previous => ({ ...previous, deadCards: value }))} />
        </div>
      </details>
      {result.error && (
        <p role="status" className={`rounded-xl border p-4 text-sm ${result.error === 'handSize' ? 'border-white/20 text-slate-300' : 'border-amber-300/40 text-amber-100'}`}>
          {errors[result.error][ja ? 0 : 1]}
        </p>
      )}
      <EquityResults result={result} alternatives={alternatives} selected={heroDiscard} players={players} ja={ja} onChoose={card => setDiscard(0, card)} />
    </section>
  );
}
