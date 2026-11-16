import React, { useEffect, useMemo, useState } from 'react';
import BadugiEquityResults from './BadugiEquityResults.jsx';
import CardPicker from './CardPicker.jsx';
import { badugiDiscardOptions } from './badugiEquity.js';
import { cardText } from './cardText.js';

const example = {
  hands: [['AC', '2D', '3H', 'KH'], ['9S', '7C', '5D', '4H']],
  remainingDraws: 1,
  heroDiscards: ['KH'],
  opponentChoice: 0,
  opponentDiscards: [],
  deadCards: [],
};

const errors = {
  handSize: ['自分と相手の手札を4枚ずつ選ぶと、ここに結果が表示されます。', 'Choose four cards for each player to see the result.'],
  card: ['カードの入力を確認してください。', 'Check the cards you entered.'],
  duplicate: ['同じカードが含まれています。手札と除外カードを確認してください。', 'A card appears more than once. Check the hands and dead cards.'],
  discard: ['交換するカードが手札にあるか確認してください。', 'Check that each discard is in its player’s hand.'],
  drawRounds: ['残りドローを0〜3回に設定してください。', 'Choose zero to three remaining draw rounds.'],
  deckTooSmall: ['指定した交換と以降のドローを計算するには、山札のカードが足りません。除外カードか交換枚数を減らしてください。', 'There are too few cards in the stock for the selected draw and the remaining rounds. Reduce the dead cards or the number of discards.'],
};

const selectClass = 'min-h-11 min-w-0 rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-base text-white';

function DiscardPicker({ hand, discards, onChange, ja }) {
  return (
    <div role="group" aria-label={ja ? '交換するカード' : 'Cards to discard'} className="space-y-2">
      <p className="text-sm font-medium">
        {ja ? '交換するカード' : 'Cards to discard'}
        <span className="ml-2 text-slate-300">
          {discards.length > 0 ? (ja ? `${discards.length}枚` : `${discards.length} selected`) : (ja ? 'パット' : 'Stand pat')}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {hand.map(card => {
          const selected = discards.includes(card);
          return (
            <button type="button" key={card} aria-pressed={selected} aria-label={ja ? `${cardText(card)} を交換` : `Discard ${cardText(card)}`} onClick={() => onChange(selected ? discards.filter(value => value !== card) : [...discards, card])} className={`min-h-11 min-w-11 rounded-lg border px-2 font-semibold ${selected ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-white/20 bg-slate-800'}`}>
              {cardText(card)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BadugiEquityCalculator({ ja }) {
  const [scenario, setScenario] = useState(example);
  const [response, setResponse] = useState(null);
  const [retry, setRetry] = useState(0);
  const { hands, remainingDraws, heroDiscards, opponentChoice, opponentDiscards, deadCards } = scenario;
  const players = ja ? ['自分', '相手'] : ['You', 'Opponent'];
  const manual = remainingDraws && opponentChoice === 5 ? opponentDiscards : null;
  const ready = hands.every(hand => hand.length === 4);
  const request = useMemo(() => ready ? { hands, remainingDraws, deadCards, opponentDiscards: manual } : null,
    [ready, hands, remainingDraws, deadCards, manual]);

  useEffect(() => {
    if (!request) return;
    let worker;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('./badugiEquity.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = event => setResponse({ request, retry, data: event.data });
        worker.onerror = () => setResponse({ request, retry, failed: true });
        worker.postMessage(request);
      } catch {
        setResponse({ request, retry, failed: true });
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [request, retry]);

  const current = response?.request === request && response?.retry === retry ? response : null;
  const choices = remainingDraws ? badugiDiscardOptions(hands[0]) : [];
  const hero = hands[0].reduce((mask, card, index) => heroDiscards.includes(card) ? mask | (1 << index) : mask, 0);
  const columns = current?.data?.columns ?? [];
  const result = current?.data?.showdown ?? columns[opponentChoice]?.results[hero];
  const error = ready ? (current?.data?.error ?? result?.error) : 'handSize';

  const update = (key, value) => setScenario(previous => ({ ...previous, [key]: value }));
  function setHand(seat, cards) {
    const key = seat === 0 ? 'heroDiscards' : 'opponentDiscards';
    setScenario(previous => ({
      ...previous,
      hands: previous.hands.map((hand, index) => index === seat ? cards : hand),
      [key]: previous[key].filter(card => cards.includes(card)),
    }));
  }

  return (
    <section aria-labelledby="badugi-equity-title" className="space-y-4">
      <header className="space-y-2">
        <h2 id="badugi-equity-title" className="text-xl font-bold sm:text-2xl">{ja ? 'Badugi エクイティ計算機' : 'Badugi equity calculator'}</h2>
        <p className="max-w-2xl text-sm text-slate-300">
          {ja ? '2人の手札をもとに、今のドローで切るカードと相手の交換枚数が、ショーダウン時の取り分にどう影響するかを比べます。' : 'Enter two known hands to compare how your discards and the opponent’s draw count affect equity at showdown.'}
        </p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          {ja ? '残りドロー' : 'Remaining draws'}
          <select className={selectClass} value={remainingDraws} onChange={event => update('remainingDraws', Number(event.target.value))}>
            <option value={0}>{ja ? '0回（ショーダウン）' : '0 (showdown)'}</option>
            <option value={1}>{ja ? '1回（3rd・最終ドロー）' : '1 (3rd / final draw)'}</option>
            <option value={2}>{ja ? '2回（2ndドローから）' : '2 (from the 2nd draw)'}</option>
            <option value={3}>{ja ? '3回（1stドローから）' : '3 (from the 1st draw)'}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3 text-emerald-200" onClick={() => setScenario({ ...example, remainingDraws })}>{ja ? '入力例を使う' : 'Load example'}</button>
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => setScenario({ ...example, hands: [[], []], remainingDraws, heroDiscards: [] })}>{ja ? 'カードをクリア' : 'Clear cards'}</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CardPicker bySuit cards={hands[0]} count={4} blocked={[...hands[1], ...deadCards]} label={players[0]} ja={ja} onChange={cards => setHand(0, cards)}>
          {remainingDraws > 0 && <DiscardPicker hand={hands[0]} discards={heroDiscards} ja={ja} onChange={cards => update('heroDiscards', cards)} />}
        </CardPicker>
        <CardPicker bySuit cards={hands[1]} count={4} blocked={[...hands[0], ...deadCards]} label={players[1]} ja={ja} onChange={cards => setHand(1, cards)}>
          {remainingDraws > 0 && (
            <div className="space-y-2">
              <label className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-3 text-sm font-medium">
                {ja ? '相手の交換' : 'Opponent’s draw'}
                <select className={selectClass} value={opponentChoice} onChange={event => update('opponentChoice', Number(event.target.value))}>
                  <option value={0}>{ja ? 'パット（0枚）' : 'Stand pat (0 cards)'}</option>
                  {[1, 2, 3, 4].map(count => <option key={count} value={count}>{ja ? `${count}枚交換` : `Draw ${count}`}</option>)}
                  <option value={5}>{ja ? '切るカードを指定' : 'Choose exact discards'}</option>
                </select>
              </label>
              {opponentChoice === 5 && <DiscardPicker hand={hands[1]} discards={opponentDiscards} ja={ja} onChange={cards => update('opponentDiscards', cards)} />}
              {opponentChoice > 0 && opponentChoice < 5 && columns[opponentChoice] && (
                <p className="text-xs text-slate-300">
                  {ja ? '相手が切ると仮定' : 'Assumed discards'} · {columns[opponentChoice].cards.map(cardText).join(' ')}
                </p>
              )}
            </div>
          )}
        </CardPicker>
      </div>
      <details className="rounded-xl border border-white/20 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-emerald-200">
          {ja ? `除外カード（任意・${deadCards.length}枚）` : `Dead cards (optional, ${deadCards.length})`}
        </summary>
        <div className="space-y-2 pb-3">
          <p className="text-sm text-slate-300">{ja ? 'すでに卓外にあると分かっているカードを指定します。' : 'Select known cards that are out of play.'}</p>
          <CardPicker bySuit cards={deadCards} blocked={hands.flat()} label={ja ? '除外カード' : 'Dead cards'} ja={ja} onChange={cards => update('deadCards', cards)} />
        </div>
      </details>
      {remainingDraws > 0 && (
        <details className="rounded-xl border border-white/20 px-3 text-sm text-slate-300">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-emerald-200">
            {remainingDraws > 1
              ? (ja ? '次のドローの方針と計算の前提' : 'Later draws and calculation assumptions')
              : (ja ? '計算の前提' : 'Calculation assumptions')}
          </summary>
          <div className="space-y-2 pb-3">
            <p>{ja ? '相手を枚数で指定すると、指定枚数を交換したうえで最も強い有効カードの組が残るように、切るカードを決めます。同じ強さの候補はカード順で決めます。' : 'For a specified opponent count, the calculator keeps the strongest valid subset possible. Card order breaks ties between equally strong choices.'}</p>
            {remainingDraws > 1 && <p>{ja ? '次のドロー以降は、両者とも完成したBadugiならパットし、未完成なら最も強い有効カードの組を残して交換します。' : 'On later draws, both players stand pat with any completed Badugi. Otherwise they keep their strongest valid subset and replace the rest.'}</p>}
            <p>{ja ? 'ベットやフォールドを挟まずショーダウンまで進み、捨て札は山札に戻さない前提です。' : 'Both players reach showdown without betting or folding. Discards are never recycled into the stock.'}</p>
          </div>
        </details>
      )}
      {ready && !current && <p role="status" className="rounded-xl border border-white/20 p-4 text-sm text-slate-300">{ja ? 'エクイティを計算中…' : 'Calculating equity…'}</p>}
      {current?.failed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/40 p-4 text-sm text-amber-100">
          <p role="status">{ja ? '計算を完了できませんでした。' : 'The calculation could not finish.'}</p>
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => setRetry(value => value + 1)}>{ja ? '再計算' : 'Retry'}</button>
        </div>
      )}
      {error && <p role="status" className={`rounded-xl border p-4 text-sm ${error === 'handSize' ? 'border-white/20 text-slate-300' : 'border-amber-300/40 text-amber-100'}`}>{errors[error][ja ? 0 : 1]}</p>}
      {result && <BadugiEquityResults result={result} columns={columns} choices={choices} hero={hero} opponent={opponentChoice} onHero={id => update('heroDiscards', choices[id])} onOpponent={id => update('opponentChoice', id)} players={players} ja={ja} />}
    </section>
  );
}
