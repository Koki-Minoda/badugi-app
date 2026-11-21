import React, { useMemo, useState } from 'react';
import { useBadugiCalculation } from './useBadugiCalculation.js';
import BadugiRangeComparison, { RangePresetField } from './BadugiRangeComparison.jsx';
import { BADUGI_RANGE_PRESETS } from './badugiRangePresets.js';
import { getReviewUserId } from '../personalResults/badugiReplayReview.js';
import { readBadugiRangeReviews } from '../personalResults/badugiRangeReviewStore.js';
import BadugiFinalBet from './BadugiFinalBet.jsx';
import BadugiEquityResults from './BadugiEquityResults.jsx';
import RangeHandsEditor from './RangeHandsEditor.jsx';
import CardPicker from './CardPicker.jsx';
import { badugiDiscardOptions } from './badugiEquity.js';
import { cardText } from './cardText.js';

const rangeExample = '9S 7C 5D 4H 3\n8S 6C 4D 2H 1';

const emptyRange = { preset: null, text: '' };

const example = {
  mode: 'fixed',
  rangeA: emptyRange,
  rangeB: emptyRange,
  hands: [['AC', '2D', '3H', 'KH'], ['9S', '7C', '5D', '4H']],
  remainingDraws: 1,
  heroDiscards: ['KH'],
  opponentChoice: 0,
  opponentDiscards: [],
  deadCards: [],
};

const errors = {
  heroSize: ['自分の手札を4枚選んでください。', 'Choose four cards for your hand.'],
  handSize: ['自分と相手の手札を4枚ずつ選ぶと、ここに結果が表示されます。', 'Choose four cards for each player to see the result.'],
  rangeEmpty: ['相手レンジの候補を選ぶか、候補手札を1組以上入力してください。', 'Choose a range preset or enter at least one possible opponent hand.'],
  rangeLimit: ['レンジは24行まで入力できます。', 'The range can contain at most 24 lines.'],
  rangeLine: ['1行に異なる4枚と、正の重みを入力してください。', 'Enter four distinct cards and a positive weight on each line.'],
  rangeBlocked: ['自分の手札や除外カードと重ならない候補がありません。', 'Every candidate overlaps your hand or the dead cards.'],
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
      <p className="text-xs text-slate-400">{ja ? "手札は変えずに、今回交換する札を選びます。" : "Select discards for this draw without editing the starting hand."}</p>
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

export default function BadugiEquityCalculator({ ja, spot = null }) {
  const [saved] = useState(() => spot ? readBadugiRangeReviews(getReviewUserId()).find(review =>
    review.handId === spot.handId && review.actionSeq === spot.actionSeq && review.remainingDraws === spot.remainingDraws
    && (spot.observedCount == null || spot.observedCount === review.count)) : null);
  const [scenario, setScenario] = useState(() => spot ? {
    ...example, mode: 'range', hands: [spot.cards, []], remainingDraws: spot.remainingDraws,
    heroDiscards: spot.actualDiscards ?? [], opponentChoice: spot.observedCount ?? saved?.count ?? -1,
    deadCards: saved?.deadCards ?? spot.deadCards,
    rangeA: saved?.assumptions[0] ?? emptyRange, rangeB: saved?.assumptions[1] ?? emptyRange,
  } : example);
  const { hands, remainingDraws, heroDiscards, opponentChoice, opponentDiscards, deadCards, mode, rangeA, rangeB } = scenario;
  const ranged = mode === 'range';
  const players = ja ? ['自分', '相手'] : ['You', 'Opponent'];
  const manual = !ranged && remainingDraws && opponentChoice === 5 ? opponentDiscards : null;
  const ready = hands[0].length === 4 && (ranged || hands[1].length === 4);
  const activeRange = ranged ? rangeA.text : null;
  const presetsRequest = useMemo(() => ranged && hands[0].length === 4 ? { presets: { hero: hands[0], deadCards } } : null,
    [ranged, hands, deadCards]);
  const { current: generated, retry: retryPresets } = useBadugiCalculation(presetsRequest);
  const presets = generated?.data?.presets;
  const countForPresets = remainingDraws === 0 ? 0 : opponentChoice;
  const defaults = BADUGI_RANGE_PRESETS.filter(({ id, draw }) => draw === countForPresets && presets?.[id]);
  const request = useMemo(() => ready ? { hands, remainingDraws, deadCards, opponentDiscards: manual, rangeText: activeRange } : null,
    [ready, hands, remainingDraws, deadCards, manual, activeRange]);
  const { current, retry } = useBadugiCalculation(request);
  const choices = remainingDraws ? badugiDiscardOptions(hands[0]) : [];
  const hero = hands[0].reduce((mask, card, index) => heroDiscards.includes(card) ? mask | (1 << index) : mask, 0);
  const columns = current?.data?.columns ?? [];
  const result = current?.data?.showdown ?? columns[opponentChoice]?.results[hero];
  const range = current?.data?.range;
  const reviewSpot = spot && remainingDraws === spot.remainingDraws && spot.cards.every(card => hands[0].includes(card)) ? spot : null;
  const error = ready ? (current?.data?.error ?? result?.error) : (ranged ? 'heroSize' : 'handSize');

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
          {ja ? '自分の手札と相手の手札またはレンジを入力し、交換によるショーダウンの取り分を比較します。' : 'Enter your hand and the opponent’s hand or range to compare showdown equity after different draws.'}
        </p>
        {spot && <p className="text-sm text-emerald-200">{spot.observedCount == null
          ? (ja ? '履歴から読み込みました。自分の手番の時点では、相手の交換枚数は未観測です。' : 'Loaded from replay. The opponent’s draw count was unknown at your decision.')
          : (ja ? `履歴から読み込みました。自分の手番までに相手は${spot.observedCount}枚交換しています。` : `Loaded from replay. The opponent had drawn ${spot.observedCount} cards before your decision.`)}</p>}
        {spot?.drawHistory.length > 0 && <details className="text-sm text-slate-300">
          <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? '手番までの交換履歴' : 'Draws observed before your turn'}</summary>
          <ul className="space-y-1 pb-2">
            {spot.drawHistory.map(({ round, player, count }, index) => <li key={index}>
              {ja ? `${round}回目 · ${player === 'hero' ? '自分' : '相手'} ${count}枚` : `Draw ${round} · ${player === 'hero' ? 'You' : 'Opponent'}: ${count}`}
            </li>)}
          </ul>
        </details>}
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
        {!spot && <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3 text-emerald-200" onClick={() => setScenario({ ...example, remainingDraws, mode, rangeA: ranged ? { preset: null, text: rangeExample } : emptyRange })}>{ja ? '入力例を使う' : 'Load example'}</button>
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => setScenario({ ...example, hands: [[], []], remainingDraws, heroDiscards: [], mode })}>{ja ? 'カードをクリア' : 'Clear cards'}</button>
        </div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CardPicker bySuit cards={hands[0]} count={4} blocked={ranged ? deadCards : [...hands[1], ...deadCards]} label={players[0]} ja={ja} onChange={cards => setHand(0, cards)}>
          {remainingDraws > 0 && <DiscardPicker hand={hands[0]} discards={heroDiscards} ja={ja} onChange={cards => update('heroDiscards', cards)} />}
        </CardPicker>
        <div className="min-w-0 space-y-3">
          <label className="grid gap-1 text-sm font-semibold">
            {ja ? '相手の手札の入力方法' : 'Opponent hand input'}
            <select className={selectClass} value={mode} onChange={event => {
              const nextMode = event.target.value;
              setScenario(previous => ({ ...previous, mode: nextMode, opponentChoice: nextMode === 'range' && previous.opponentChoice === 5 ? -1 : previous.opponentChoice }));
            }}>
              <option value="fixed">{ja ? '固定手札' : 'Exact hand'}</option>
              <option value="range">{ja ? 'レンジ（複数の候補）' : 'Range (weighted candidates)'}</option>
            </select>
          </label>
          {ranged ? <div className="space-y-2">
            <RangePresetField label={ja ? 'レンジAの候補' : 'Range A preset'} value={rangeA.preset} presets={presets}
              count={countForPresets} onChange={value => update('rangeA', value)} ja={ja} />
            {presetsRequest && !generated && <p role="status" className="text-xs text-slate-300">{ja ? '候補を作成中…' : 'Generating presets…'}</p>}
            {generated?.failed && <button type="button" className="min-h-11 text-sm text-emerald-200 underline" onClick={retryPresets}>
              {ja ? 'レンジ候補を再作成' : 'Regenerate presets'}
            </button>}
            {presets && !Object.values(presets).some(Boolean) && <p className="text-xs text-slate-300">
              {ja ? 'いまの除外カードでは候補手札を作れません。' : 'No possible hands with these dead cards.'}
            </p>}
            <p className="text-xs text-slate-300">{ja
              ? '既知カードを除いた代表例です。各グループ最大8組で、8以下と9〜Kを混ぜる場合は両グループを同じ重みにします。'
              : 'Presets use up to eight representative hands per group after removing known cards. Mixed presets give equal weight to the low and high groups.'}</p>
            {remainingDraws > 0 && defaults.length === 2 && !rangeA.text && !rangeB.text && <button type="button"
              className="min-h-11 rounded-lg border border-emerald-300/40 px-3 text-sm font-semibold text-emerald-200"
              onClick={() => setScenario(previous => ({ ...previous,
                rangeA: { preset: defaults[0].id, text: presets[defaults[0].id].text },
                rangeB: { preset: defaults[1].id, text: presets[defaults[1].id].text },
              }))}>
              {ja ? '交換枚数に合う2つの候補を入れる' : 'Load two presets for this draw count'}
            </button>}
            <RangeHandsEditor name="A" text={rangeA.text} onChange={value => update('rangeA', value)} ja={ja} />
            {range && <p className="text-xs text-emerald-200">{ja
              ? `有効な候補 ${range.hands}組 · 既知カードと重なる行 ${range.excluded}件を除外。残りの重みで再計算しています。`
              : `${range.hands} valid hands · ${range.excluded} blocked rows removed. Remaining weights are normalized.`}</p>}
          </div> : <CardPicker bySuit cards={hands[1]} count={4} blocked={[...hands[0], ...deadCards]} label={players[1]} ja={ja} onChange={cards => setHand(1, cards)} />}
          {remainingDraws > 0 && <div className="space-y-2">
            <label className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-3 text-sm font-medium">
              {ja ? '相手の交換' : 'Opponent’s draw'}
              <select className={selectClass} value={opponentChoice} onChange={event => update('opponentChoice', Number(event.target.value))}>
                <option value={-1}>{ja ? '未指定（枚数別に比較）' : 'Unspecified (compare counts)'}</option>
                <option value={0}>{ja ? 'パット（0枚）' : 'Stand pat (0 cards)'}</option>
                {[1, 2, 3, 4].map(count => <option key={count} value={count}>{ja ? `${count}枚交換` : `Draw ${count}`}</option>)}
                {!ranged && <option value={5}>{ja ? '切るカードを指定' : 'Choose exact discards'}</option>}
              </select>
            </label>
            {opponentChoice === 5 && <DiscardPicker hand={hands[1]} discards={opponentDiscards} ja={ja} onChange={cards => update('opponentDiscards', cards)} />}
            {opponentChoice > 0 && opponentChoice < 5 && columns[opponentChoice]?.cards && (
              <p className="text-xs text-slate-300">{ja ? '相手が切ると仮定' : 'Assumed discards'} · {columns[opponentChoice].cards.map(cardText).join(' ')}</p>
            )}
          </div>}
        </div>
      </div>
      <details className="rounded-xl border border-white/20 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-emerald-200">
          {ja ? `除外カード（任意・${deadCards.length}枚）` : `Dead cards (optional, ${deadCards.length})`}
        </summary>
        <div className="space-y-2 pb-3">
          <p className="text-sm text-slate-300">{ja ? 'すでに卓外にあると分かっているカードを指定します。' : 'Select known cards that are out of play.'}</p>
          <CardPicker bySuit cards={deadCards} blocked={ranged ? hands[0] : hands.flat()} label={ja ? '除外カード' : 'Dead cards'} ja={ja} onChange={cards => update('deadCards', cards)} />
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
      {ranged && remainingDraws > 0 && <BadugiRangeComparison base={request} assumptions={[rangeA, rangeB]}
        onAlternate={value => update('rangeB', value)} count={opponentChoice} presets={presets} spot={reviewSpot} saved={saved} errors={errors} ja={ja} />}
      {ready && !current && <p role="status" className="rounded-xl border border-white/20 p-4 text-sm text-slate-300">{ja ? 'エクイティを計算中…' : 'Calculating equity…'}</p>}
      {current?.failed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/40 p-4 text-sm text-amber-100">
          <p role="status">{ja ? '計算を完了できませんでした。' : 'The calculation could not finish.'}</p>
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={retry}>{ja ? '再計算' : 'Retry'}</button>
        </div>
      )}
      {error && <p role="status" className={`rounded-xl border p-4 text-sm ${error === 'handSize' ? 'border-white/20 text-slate-300' : 'border-amber-300/40 text-amber-100'}`}>{current?.data?.line && (ja ? `${current.data.line}行目 · ` : `Line ${current.data.line} · `)}{errors[error][ja ? 0 : 1]}</p>}
      {(result || columns.length > 0) && <div className="space-y-3" data-testid="equity-detail-results">
        {ranged && <div className="rounded-xl border border-emerald-300/30 p-3 text-sm">
          <h3 className="font-bold">{ja ? 'レンジAの詳細結果' : 'Detailed results for Range A'}</h3>
          <p className="mt-1 text-slate-300">{ja ? '自分' : 'You'}: {remainingDraws === 0 ? (ja ? '交換なし（最終手札）' : 'Final hand, no draw') : heroDiscards.length ? heroDiscards.map(cardText).join(' ') + (ja ? ' を交換' : ' discarded') : (ja ? 'パット' : 'Stand pat')} · {ja ? '相手' : 'Opponent'}: {remainingDraws === 0 ? (ja ? '交換なし' : 'No draw') : opponentChoice < 0 ? (ja ? '交換枚数ごとの比較' : 'Compare all draw counts') : (ja ? `${opponentChoice}枚交換` : `Draw ${opponentChoice}`)} · {ja ? `残り${remainingDraws}ドロー` : `${remainingDraws} draws remaining`}</p>
        </div>}
        <BadugiEquityResults result={result} columns={columns} choices={choices} hero={hero} opponent={opponentChoice} onHero={id => update('heroDiscards', choices[id])} onOpponent={id => update('opponentChoice', id)} players={players} ja={ja} />
      </div>}
      {remainingDraws <= 2 && <BadugiFinalBet base={request} remainingDraws={remainingDraws} opponentCount={opponentChoice} spot={reviewSpot} ja={ja} />}
    </section>
  );
}
