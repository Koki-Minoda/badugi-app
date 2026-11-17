import React, { useMemo, useState } from 'react';
import { cardText } from '../tools/cardText.js';
import { useBadugiCalculation } from '../tools/useBadugiCalculation.js';
import {
  assessSecondDrawPair,
  measureSecondDrawTransfer,
  readSecondDrawProgress,
  saveSecondDrawProgress,
  SECOND_DRAW_SETTINGS,
  secondDrawPairRequest,
  secondDrawPairs,
  summarizeSecondDrawPractice,
} from './badugiSecondDraw.js';

const control = 'min-h-11 rounded-xl border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-200';
const field = 'mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-base';
const reads = {
  strong: ['低い完成手が多い', 'Mostly strong made hands'],
  weak: ['高めの完成手も多い', 'Many weaker made hands'],
  draw: ['3枚を残して引き直す手が多い', 'Mostly drawing from three cards'],
  uncertain: ['絞りきれない', 'Hard to narrow down'],
};
const reasons = {
  preserve: ['今の完成手を維持する価値', 'Value of keeping a made hand'],
  improve: ['引き直して改善する見込み', 'Chance of improving by drawing'],
  betting: ['ポットと後のベット', 'Pot and later betting'],
};
const initialAnswer = { move: '', read: '', reason: '' };

function actionName(card, ja) {
  return !card || card === 'pat' ? (ja ? 'パット' : 'Stand pat') : (ja ? `${cardText(card)} を切る` : `Discard ${cardText(card)}`);
}

function spotDescription(spot, ja) {
  const action = spot.opponentCount === 0 ? (ja ? '相手はパット' : 'Opponent stands pat') : (ja ? '相手は1枚交換' : 'Opponent draws one');
  const range = spot.range === '8to9' ? (ja ? '交換前は8〜9ハイ中心' : 'Mostly eight- to nine-high before drawing') : (ja ? '交換前はQ〜Kハイ中心' : 'Mostly queen- to king-high before drawing');
  return `${action} · ${range}`;
}

function Assumptions({ ja }) {
  return <details className="text-sm text-slate-300">
    <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? 'この練習の計算条件' : 'Calculation assumptions'}</summary>
    <p>{ja
      ? '相手は問題に示したレンジから、指定枚数を交換すると仮定します。初期ポット30チップ、2nd後は両者チェック、最終ベット10チップ。3rdでは完成手はパットし、未完成なら最も強い有効カードを残します。最終ベットでは、相手はT以下でベットし、チェック後はQ以下でコール。自分はJ以下でコールし、チェックを受けたらT以下でベットします。'
      : 'The opponent draws the stated count from the assumed range. The pot is 30 chips. Both check after the second draw, and the final bet is 10. On the third draw, made hands stand pat and other hands keep their strongest valid subset. The opponent leads through ten-high and check-calls through queen-high. You call through jack-high and bet through ten-high after a check.'}</p>
  </details>;
}

function changeExplanation(spot, ja) {
  if (spot.opponentCount === 1) return ja
    ? '相手は完成手の1枚を外すため、自分はTハイを保って相手が引き直しに失敗する分を取り込めます。'
    : 'The opponent breaks their made hand. Keeping your ten-high lets you win when their draw misses.';
  if (spot.range === '8to9') return ja
    ? '相手が8〜9ハイで止まるので、今のTハイでは届きません。Tを切ると、残した3枚でより低いBadugiを狙えます。'
    : 'A pat eight- or nine-high beats your ten-high. Breaking the ten keeps three cards that can complete a stronger Badugi.';
  return ja
    ? '相手がQ〜Kハイで止まるなら、今のTハイが上回っています。'
    : 'Your ten-high already beats a pat queen- or king-high.';
}

function Feedback({ pair, assessment, ja }) {
  const format = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(ja ? 'ja-JP' : 'en-US', { style: 'percent', maximumFractionDigits: 1 });
  const changed = assessment[0].best.cards[0] !== assessment[1].best.cards[0];
  return <div className="space-y-2 rounded-xl border border-emerald-300/25 p-3 text-sm">
    <p className="font-bold text-emerald-200">{changed
      ? (ja ? '条件が変わると、有利な行動も変わります。' : 'The better move changes with the condition.')
      : (ja ? 'このペアでは、条件が変わっても有利な行動は同じです。' : 'The same move remains better in this pair.')}</p>
    {assessment.map((decision, index) => (
      <div className="space-y-1 border-t border-white/10 pt-2" key={index}>
        <p className="font-semibold">{spotDescription(pair.spots[index], ja)}</p>
        <p>{ja ? 'あなたの選択' : 'Your choice'} {actionName(decision.chosen.cards[0], ja)} · {ja ? 'モデル内の最良候補' : 'Best in model'} {actionName(decision.best.cards[0], ja)}</p>
        {decision.pat && decision.redraw && <ul className="space-y-1 text-xs text-slate-300">
          {[decision.pat, decision.redraw].map(action => <li key={action.cards[0] ?? 'pat'}>
            {actionName(action.cards[0], ja)} · {ja ? '取り分' : 'Equity'} {percent.format(action.equity)} · {ja ? '推定EV' : 'Estimated EV'} {format.format(action.ev)} {ja ? 'チップ' : 'chips'}
          </li>)}
        </ul>}
        <p className="text-slate-300">{ja
          ? `あなたの選択と最良候補のEV差 ${format.format(decision.loss)}チップ`
          : `EV gap from your choice to the best in the model: ${format.format(decision.loss)} chips`}</p>
        <p className="text-xs text-slate-300">{changeExplanation(pair.spots[index], ja)}</p>
        <p className="text-xs text-slate-300">{ja ? '見立て' : 'Your read'} · {reads[decision.read][ja ? 0 : 1]} · {ja ? '理由' : 'Reason'} · {reasons[decision.reason][ja ? 0 : 1]}</p>
        <details className="text-xs text-slate-300">
          <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? 'この問題で使った相手レンジ' : 'Opponent range used here'}</summary>
          <pre className="whitespace-pre-wrap">{pair.spots[index].rangeText}</pre>
        </details>
      </div>
    ))}
  </div>;
}

function DrawPair({ pair, index, total, mode, ja, onNext }) {
  const [answers, setAnswers] = useState([initialAnswer, initialAnswer]);
  const [submitted, setSubmitted] = useState(false);
  const request = useMemo(() => submitted ? secondDrawPairRequest(pair) : null, [submitted, pair]);
  const { current, retry } = useBadugiCalculation(request);
  const results = current?.data?.pair;
  const failed = current?.failed || results?.some(result => result.error);
  const grade = results && !failed ? assessSecondDrawPair(results, answers) : null;
  const update = (index, field, value) => setAnswers(previous => previous.map((answer, i) => i === index ? { ...answer, [field]: value } : answer));
  return <div className="space-y-3">
    <p className="text-sm font-semibold">{ja ? `ペア ${index + 1} / ${total}` : `Pair ${index + 1} / ${total}`}</p>
    <div className="flex gap-2" aria-label={ja ? '自分の手札' : 'Your hand'}>
      {pair.hero.map(card => <span key={card} className={`rounded bg-white px-2 py-1 font-bold ${/[HD]$/.test(card) ? 'text-red-700' : 'text-slate-950'}`}>{cardText(card)}</span>)}
    </div>
    <Assumptions ja={ja} />
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {pair.spots.map((spot, index) => <fieldset disabled={submitted} key={index} className="min-w-0 space-y-2 rounded-xl border border-white/15 p-3">
          <legend className="px-1 text-sm font-bold">{ja ? `局面 ${index === 0 ? 'A' : 'B'}` : `Spot ${index === 0 ? 'A' : 'B'}`}</legend>
          <p className="text-sm text-slate-300">{spotDescription(spot, ja)}</p>
          <label className="block text-sm">{ja ? '相手の見立て' : 'Your read'}<select className={field} required value={answers[index].read} onChange={event => update(index, 'read', event.target.value)}>
            <option value="">—</option>
            {Object.entries(reads).map(([id, labels]) => <option value={id} key={id}>{labels[ja ? 0 : 1]}</option>)}
          </select></label>
          <label className="block text-sm">{ja ? '自分の選択' : 'Your action'}<select className={field} required value={answers[index].move} onChange={event => update(index, 'move', event.target.value)}>
            <option value="">—</option>
            {['pat', ...pair.hero].map(card => <option value={card} key={card}>{actionName(card, ja)}</option>)}
          </select></label>
          <label className="block text-sm">{ja ? '判断の理由' : 'Reason'}<select className={field} required value={answers[index].reason} onChange={event => update(index, 'reason', event.target.value)}>
            <option value="">—</option>
            {Object.entries(reasons).map(([id, labels]) => <option value={id} key={id}>{labels[ja ? 0 : 1]}</option>)}
          </select></label>
        </fieldset>)}
      </div>
      {!submitted && <button className={control} type="submit">{mode === 'retest' ? (ja ? '2つの回答を記録' : 'Record both answers') : (ja ? '2つの結果を比較' : 'Compare both results')}</button>}
    </form>
    {submitted && !current && <p role="status" className="text-sm">{ja ? '計算中…' : 'Calculating…'}</p>}
    {failed && <button className={control} type="button" onClick={retry}>{ja ? '再計算する' : 'Retry calculation'}</button>}
    {grade && <>
      {mode === 'retest' ? <p role="status" className="text-sm">{ja ? '回答を記録しました。結果は全ペアの回答後に表示します。' : 'Answers recorded. Results appear after all pairs.'}</p>
        : <Feedback pair={pair} assessment={grade} ja={ja} />}
      <button type="button" className={control} onClick={() => onNext(grade)}>{index + 1 < total ? (ja ? '次のペア' : 'Next pair') : (ja ? '結果を保存する' : 'Save results')}</button>
    </>}
  </div>;
}

function CohortResults({ transfer, onReplay, ja }) {
  return <section className="space-y-2 rounded-xl border border-white/15 p-3">
    <h3 className="font-semibold">{ja ? '実戦の2ndドロー' : 'Second draws in your play'}</h3>
    <p className="text-xs text-slate-300">{ja
      ? '完了した2人対戦のうち、相手の交換を見て完成手からパットか1枚交換した局面を、練習前後それぞれ最大20件追います。EV差は、保存したレンジとベット方針のもとで誤差の目安と0.05ベットの両方を超えた場合に数えます。'
      : 'Tracks up to 20 completed heads-up decisions per window with an observed opponent draw and a made hand you kept or broke by one card. Counts EV gaps exceeding both the sampling margin and 0.05 bets under the saved assumptions.'}</p>
    <table className="w-full text-left text-xs tabular-nums">
      <thead><tr>
        <th scope="col" className="py-2">{ja ? '期間' : 'Window'}</th>
        <th scope="col">{ja ? '対象' : 'Eligible'}</th>
        <th scope="col">{ja ? '復習済み' : 'Reviewed'}</th>
        <th scope="col">{ja ? '明確なEV差' : 'Clear EV gaps'}</th>
      </tr></thead>
      <tbody>{[[ja ? '練習前' : 'Before', transfer.before], [ja ? '練習後' : 'After', transfer.after]].map(([label, period]) => (
        <tr key={label} className="border-t border-white/15"><th scope="row" className="py-2">{label}</th><td>{period.opportunities}</td><td>{period.reviewed}</td><td>{period.reviewed ? `${period.gaps}/${period.reviewed}` : '—'}</td></tr>
      ))}</tbody>
    </table>
    {transfer.next && onReplay && <button type="button" className={control} onClick={() => onReplay(transfer.next.handId, {
      handId: transfer.next.handId, actionSeqStart: transfer.next.actionSeq, actionSeqEnd: transfer.next.actionSeq,
    })}>{ja ? '次の対象ハンドを復習' : 'Review the next eligible hand'}</button>}
  </section>;
}

export default function SecondDrawLearning({ userId, hands, reviews, onReplay, ja }) {
  const [progress, setProgress] = useState(() => readSecondDrawProgress(userId));
  const [run, setRun] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const transfer = useMemo(() => progress.practice ? measureSecondDrawTransfer(hands, reviews, progress.practice, userId) : null,
    [hands, reviews, progress.practice, userId]);
  const pairs = run ? secondDrawPairs(run.mode) : [];
  const nextIndex = run?.attempts.length ?? 0;
  function next(grade) {
    const attempts = [...run.attempts, grade];
    if (attempts.length < pairs.length) {
      setRun({ ...run, attempts });
      return;
    }
    const entry = { startedAt: run.startedAt, finishedAt: Date.now(), ...summarizeSecondDrawPractice(attempts), attempts };
    const nextProgress = { ...progress, [run.mode]: entry };
    setSaveError(!saveSecondDrawProgress(userId, nextProgress));
    setProgress(nextProgress);
    setRun(null);
  }

  return <section className="space-y-3 rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-4">
    <h2 className="font-bold">{ja ? 'Badugi · 2ndドローの判断練習' : 'Badugi · Second-draw decisions'}</h2>
    {run ? <>
      <button type="button" className={control} onClick={() => setRun(null)}>{ja ? '練習を閉じる' : 'Close practice'}</button>
      <DrawPair key={pairs[nextIndex].id} pair={pairs[nextIndex]} index={nextIndex} total={pairs.length} mode={run.mode} ja={ja} onNext={next} />
    </> : <>
      <p className="text-sm text-slate-300">{ja
        ? '同じ手札で相手の交換枚数やレンジだけを変えた2局面を比べ、パットと1枚交換を使い分けます。'
        : 'Compare two spots with the same hand and a different opponent draw count or range. Decide when to stand pat or draw one.'}</p>
      {!progress.practice && <button className={control} type="button" onClick={() => setRun({ mode: 'practice', startedAt: Date.now(), attempts: [] })}>{ja ? '2ndドローを3ペア練習' : 'Practice three second-draw pairs'}</button>}
      {progress.practice && !progress.retest && <button className={control} type="button" onClick={() => setRun({ mode: 'retest', startedAt: Date.now(), attempts: [] })}>{ja ? '初見の3ペアで再測定' : 'Retest on three unseen pairs'}</button>}
      {[['practice', ja ? '初回練習' : 'First practice'], ['retest', ja ? '初見問題' : 'Unseen retest']].filter(([id]) => progress[id]).map(([id, label]) => (
        <div className="rounded-xl border border-white/15 p-3 text-sm" key={id}>
          <h3 className="font-semibold">{label}</h3>
          <p className="mt-1">{ja
            ? `両方で最良候補に近かったペア ${progress[id].closePairs}/${progress[id].pairs} · 平均EV差 ${progress[id].meanLoss.toFixed(3)} ベット`
            : `Pairs with both choices near best: ${progress[id].closePairs}/${progress[id].pairs} · Mean EV gap: ${progress[id].meanLoss.toFixed(3)} bets`}</p>
          {progress[id].attempts && <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? '各ペアの結果' : 'See each pair'}</summary>
            <div className="space-y-2">
              {progress[id].attempts.map((assessment, index) => <Feedback key={index} pair={secondDrawPairs(id)[index]} assessment={assessment} ja={ja} />)}
            </div>
          </details>}
        </div>
      ))}
      {transfer && <CohortResults transfer={transfer} onReplay={onReplay} ja={ja} />}
      {saveError && <p role="status" className="text-sm text-amber-100">{ja ? 'この端末に練習結果を保存できませんでした。' : 'This device could not save the result.'}</p>}
    </>}
  </section>;
}
