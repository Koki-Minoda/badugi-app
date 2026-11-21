import React, { useState } from "react";
import {
  CLOSE_EV, evaluateFinalDraw, finalDrawQuestions, finalDrawRangeExamples, RANGE_MODELS, RETEST_DELAY,
  summarizeFinalDrawAttempts,
} from "./badugiFinalDraw.js";

const actionStyle = "rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40";
const field = "mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm";
const symbols = { S: "♠", H: "♥", D: "♦", C: "♣" };
const reasons = {
  range: ["相手が残していそうなカード", "Opponent's likely holdings"],
  redraw: ["自分が引き直して改善する見込み", "Chance of improving after drawing"],
  betting: ["ポットと最終ベット", "Pot and final betting"],
};
const confidenceLabels = {
  low: ["低い", "Low"], medium: ["中くらい", "Medium"], high: ["高い", "High"],
};

function ReviewResults({ reviews, ja, onReplay, practiceLabel, onPractice }) {
  const latest = reviews[0];
  const displayCards = cards => cards.length ? cards.map(cardLabel).join(" ") : actionLabel("pat", ja);
  const mean = reviews.reduce((sum, review) => sum + review.loss / review.bet, 0) / reviews.length;
  return <div className="mt-3 rounded-xl border border-white/15 p-3 text-sm">
    <h3 className="font-semibold">{ja ? "対局の判断レビュー" : "Reviewed decisions"}</h3>
    <p className="mt-1 text-slate-300">{ja ? `保存 ${reviews.length}件 · モデル上の平均EV差 ${mean.toFixed(3)} ベット` : `${reviews.length} saved · Mean modeled EV gap ${mean.toFixed(3)} bets`}</p>
    <p className="mt-1">{ja ? "直近の選択" : "Latest choice"} {displayCards(latest.cards)} · {ja ? "最良候補" : "Best in model"} {displayCards(latest.best)} · {ja ? "差" : "Gap"} {latest.loss.toFixed(3)} {ja ? "チップ" : "chips"}</p>
    {latest.settings && <details className="mt-2 text-slate-300">
      <summary className="cursor-pointer">{ja ? "保存した計算の前提" : "Saved assumptions"}</summary>
      <p className="my-1">{ja ? `ポット ${latest.settings.pot} · 1ベット ${latest.bet} · 相手は${latest.opponentCount}枚交換` : `Pot ${latest.settings.pot} · Bet ${latest.bet} · Opponent draws ${latest.opponentCount}`}</p>
      <p>{ja ? `ベットする上限 ${latest.settings.lead || "なし"} · チェック後にコールする上限 ${latest.settings.call || "なし"}` : `Lead through ${latest.settings.lead || "off"} · Check-call through ${latest.settings.call || "off"}`}</p>
      {latest.rangeText && <pre className="mt-1 whitespace-pre-wrap break-words text-xs">{latest.rangeText}</pre>}
    </details>}
    <div className="mt-3 flex flex-wrap gap-2">
      {onReplay && <button type="button" className={actionStyle} onClick={() => onReplay(latest.handId, { handId: latest.handId, actionSeqStart: latest.actionSeq, actionSeqEnd: latest.actionSeq })}>{ja ? "この判断に戻る" : "Return to this decision"}</button>}
      {practiceLabel && <button type="button" className={actionStyle} onClick={onPractice}>{practiceLabel}</button>}
    </div>
  </div>;
}

function readProgress(key) {
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
}

function cardLabel(card) {
  return card.slice(0, -1).replace(/^10$/, "T") + symbols[card.at(-1)];
}

function actionLabel(id, ja) {
  return id === "pat" ? (ja ? "パット" : "Stand pat") : ja ? `${cardLabel(id)}を切る` : `Discard ${cardLabel(id)}`;
}

function Model({ question, ja }) {
  const [low, high] = finalDrawRangeExamples(question.opponentDraw);
  return <details className="mt-3 rounded-xl border border-white/10 p-3 text-xs leading-relaxed text-slate-300">
    <summary className="cursor-pointer">{ja ? "EVの計算条件" : "EV assumptions"}</summary>
    <p className="mt-2">{ja
      ? "ヘッズアップの固定リミット。相手のレンジは練習用の仮定です。相手は交換後にT以下の完成Badugiで1ベットし、それ以外はチェック。自分は相手がチェックしたらチェックし、ベットされたときは見えている手札でEVが高い方をコールかフォールドから選びます。レイズはモデルの対象外です。"
      : "Heads-up fixed limit with an illustrative range. Opponent bets once with a made T-or-better Badugi and otherwise checks. Hero checks back or chooses call/fold from the information available at the bet. Raises are outside this model."}</p>
    <p className="mt-2">{ja
      ? `低い組み合わせの想定比率は ${Math.round(RANGE_MODELS[question.range].lowWeight * 100)}%。候補のスートと残り札を重複なしで列挙。単位は最終ストリートのベット額（BBet）です。`
      : `Low combinations have ${Math.round(RANGE_MODELS[question.range].lowWeight * 100)}% weight. Available suits and draws are enumerated without replacement. Values are in final-street bets (BBet).`}</p>
    <p className="mt-2">{ja ? `低い組み合わせ ${low} ／ 高い組み合わせ ${high}` : `Low templates ${low} · High templates ${high}`}</p>
  </details>;
}

function Spot({ question, ja }) {
  const pot = Number(question.pot.toFixed(2));
  return <>
    <p className="mt-2 text-sm text-slate-300">
      {ja ? "ヘッズアップ · 3rdドロー · あなたは後手" : "Heads-up · Third draw · You act last"}
    </p>
    <p className="mt-2 text-sm">
      {ja
        ? `相手は${question.opponentDraw === 0 ? "パット" : "1枚交換"}。ポット ${pot} BBet（最終ベット額の${pot}倍）。想定レンジは「${RANGE_MODELS[question.range].ja}」。`
        : `Opponent ${question.opponentDraw === 0 ? "stood pat" : "drew one"}. Pot ${pot} BBet (${pot} × the final-street bet). ${RANGE_MODELS[question.range].en}.`}
    </p>
    <p className="mt-3 flex flex-wrap gap-2" aria-label={ja ? "あなたの手札" : "Your cards"}>
      {question.cards.map((card) => <span key={card} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-950">{cardLabel(card)}</span>)}
    </p>
  </>;
}

function Results({ question, answer, result, ja }) {
  const selected = result.actions.find((action) => action.id === answer);
  return <div className="mt-4">
    <p className="font-semibold text-emerald-200">
      {ja ? `あなたの選択: ${actionLabel(answer, ja)} · EV差 ${selected.loss.toFixed(3)} BBet` : `Your choice: ${actionLabel(answer, ja)} · EV loss ${selected.loss.toFixed(3)} BBet`}
    </p>
    {result.actions[1].loss <= CLOSE_EV && <p className="mt-2 text-sm text-slate-300">
      {ja ? "上位候補の差が0.01 BBet以内です。この練習では同程度と扱います。" : "Top choices are within 0.01 BBet and are treated as close in this drill."}
    </p>}
    <table className="mt-2 w-full text-left text-sm">
      <thead><tr><th scope="col">{ja ? "選択" : "Action"}</th><th scope="col" className="text-right">EV (BBet)</th></tr></thead>
      <tbody>{result.actions.map((action) => <tr key={action.id} className="border-t border-white/10">
        <td className="py-1.5">{actionLabel(action.id, ja)}</td><td className="text-right tabular-nums">{action.ev.toFixed(3)}</td>
      </tr>)}</tbody>
    </table>
    <Model question={question} ja={ja} />
  </div>;
}

function Question({ question, index, ja, mode, onNext, onCompare }) {
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState(null);
  const [alternative, setAlternative] = useState(null);
  const feedbackAtEnd = ["retest", "transfer", "transferRetest"].includes(mode);
  function submit(event) {
    event.preventDefault();
    if (feedbackAtEnd) {
      const loss = evaluateFinalDraw(question).actions.find((action) => action.id === answer).loss;
      onNext({ loss, confidence, reason });
    } else {
      setResult(evaluateFinalDraw(question));
    }
  }
  return <>
    <p className="text-xs text-emerald-300">{index + 1} / 5</p>
    <Spot question={question} ja={ja} />
    {!result ? <form className="mt-4 space-y-3" onSubmit={submit}>
      <label className="block text-sm">{ja ? "どのアクションを取る？" : "What do you do?"}
        <select required className={field} value={answer} onChange={(event) => setAnswer(event.target.value)}>
          <option value="">—</option>{["pat", ...question.cards].map((id) => <option key={id} value={id}>{actionLabel(id, ja)}</option>)}
        </select>
      </label>
      <label className="block text-sm">{ja ? "判断で重視した情報" : "What mattered most?"}
        <select required className={field} value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">—</option>{Object.entries(reasons).map(([id, labels]) => <option key={id} value={id}>{labels[ja ? 0 : 1]}</option>)}
        </select>
      </label>
      <label className="block text-sm">{ja ? "その判断への自信" : "Confidence"}
        <select required className={field} value={confidence} onChange={(event) => setConfidence(event.target.value)}>
          <option value="">—</option>{Object.entries(confidenceLabels).map(([id, labels]) => <option key={id} value={id}>{labels[ja ? 0 : 1]}</option>)}
        </select>
      </label>
      <button className={actionStyle} type="submit">{feedbackAtEnd ? (ja ? "回答を記録" : "Record answer") : (ja ? "EVを比較" : "Compare EV")}</button>
    </form> : <>
      <p className="text-xs text-slate-400">{ja ? "あなたが重視した情報" : "What you prioritized"} · {reasons[reason][ja ? 0 : 1]}</p>
      <Results question={question} answer={answer} result={result} ja={ja} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={actionStyle} type="button" onClick={() => setAlternative(alternative ? null : onCompare(question))}>
          {alternative ? (ja ? "比較を閉じる" : "Close comparison") : (ja ? "相手の想定を変える" : "Change opponent assumption")}
        </button>
        <button className={actionStyle} type="button" onClick={() => onNext({ loss: result.actions.find((action) => action.id === answer).loss, confidence, reason })}>
          {index === 4 ? (ja ? "練習を完了" : "Finish practice") : (ja ? "次の問題" : "Next question")}
        </button>
      </div>
      {alternative && <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-sm">{ja ? `変更後の想定レンジ「${RANGE_MODELS[alternative.question.range].ja}」` : RANGE_MODELS[alternative.question.range].en}</p>
        <p className="mt-1 text-xs text-slate-400">{ja ? "相手の交換枚数、手札、ポットは同じです。" : "Draw count, your hand, and pot are unchanged."}</p>
        <p className="mt-2 text-sm text-emerald-200">{result.actions[0].id === alternative.result.actions[0].id
          ? (ja ? "この変更では最良候補は同じです。" : "The leading choice stays the same.")
          : (ja ? `最良候補が「${actionLabel(result.actions[0].id, ja)}」から「${actionLabel(alternative.result.actions[0].id, ja)}」に変わります。`
            : `The leading choice changes from ${actionLabel(result.actions[0].id, ja)} to ${actionLabel(alternative.result.actions[0].id, ja)}.`)}</p>
        <Results question={alternative.question} answer={answer} result={alternative.result} ja={ja} />
      </div>}
    </>}
  </>;
}

function Summary({ title, data, ja }) {
  return <div className="mt-3 rounded-xl border border-white/10 p-3 text-sm">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{ja
      ? `平均EV損失 ${data.meanLoss.toFixed(3)} BBet · 最良候補との差が0.01以内 ${data.closeChoices}/${data.count}問`
      : `Mean EV loss ${data.meanLoss.toFixed(3)} BBet · Within 0.01 of best ${data.closeChoices}/${data.count}`}</p>
    <p className="mt-1 text-slate-400">{ja ? `自信「高い」でEV差が0.01を超えた判断 ${data.highConfidenceMisses}件` : `High-confidence decisions losing more than 0.01 BBet: ${data.highConfidenceMisses}`}</p>
  </div>;
}

export default function FinalDrawPractice({ userId, ja, review, decisionReviews = [], onReplay }) {
  const key = userId == null ? null : `mgx.badugiFinalDraw.v1:${userId}`;
  const [progress, setProgress] = useState(() => readProgress(key));
  const [mode, setMode] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [reviewRange, setReviewRange] = useState(null);
  const [error, setError] = useState(false);
  const dueAt = progress.practice ? progress.practice.at + RETEST_DELAY : null;
  const eligible = dueAt != null && Date.now() >= dueAt;
  const question = mode ? finalDrawQuestions(mode)[attempts.length] : null;

  function start(nextMode) {
    setAttempts([]);
    setMode(nextMode);
  }

  function next(attempt) {
    const completed = [...attempts, attempt];
    if (completed.length < 5) {
      setAttempts(completed);
      return;
    }
    const entry = { at: Date.now(), ...summarizeFinalDrawAttempts(completed) };
    const updated = { ...progress, [mode]: entry };
    if (key) {
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { setError(true); }
    }
    setProgress(updated);
    setMode(null);
    setAttempts([]);
  }

  function compare(previous) {
    const changed = { ...previous, range: RANGE_MODELS[previous.range].lowWeight > 0.5 ? "high" : "onlyLow" };
    return { question: changed, result: evaluateFinalDraw(changed) };
  }

  const reviewQuestion = reviewRange && review ? { ...review, range: reviewRange } : null;
  const practiceLabel = progress.transferRetest ? null : progress.transfer
    ? (ja ? "新しい5問で再測定" : "Retest on five new spots")
    : (ja ? "別の局面で5問練習" : "Practice five different spots");
  const modeDescription = {
    retest: ["未出題の5問 · 終了後に結果を表示", "Five unseen questions · Results at the end"],
    transfer: ["相手の交換やレンジが異なる5局面 · 終了後に結果を表示", "Five different draws and ranges · Results at the end"],
    transferRetest: ["初回とは異なる5問 · 終了後に結果を表示", "Five different questions · Results at the end"],
    practice: ["条件を変えて5問練習", "Five questions with changing conditions"],
  };
  return <section className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 p-4">
    <h2 className="font-semibold">{ja ? "Badugi · 3rdドロー判断" : "Badugi · Third-draw decisions"}</h2>
    {mode ? <div className="mt-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-300">{(modeDescription[mode] ?? modeDescription.practice)[ja ? 0 : 1]}</p>
        <button type="button" className={actionStyle} onClick={() => setMode(null)}>{ja ? "練習を閉じる" : "Close drill"}</button>
      </div>
      <Question key={`${mode}:${attempts.length}`} question={question} index={attempts.length} ja={ja} mode={mode} onNext={next} onCompare={compare} />
    </div> : <>
      <p className="mt-2 text-sm text-slate-300">{ja
        ? "パットと1枚交換を、相手のレンジごとに比較します。練習用のEVはレーダーの実戦スコアに反映されません。"
        : "Compare standing pat and drawing one under different opponent ranges. Drill EV is excluded from the live-play radar."}</p>
      {decisionReviews.length > 0 && <ReviewResults reviews={decisionReviews} ja={ja} onReplay={onReplay} practiceLabel={practiceLabel} onPractice={() => start(progress.transfer ? "transferRetest" : "transfer")} />}
      {progress.transfer && <Summary title={ja ? "別の5局面での練習結果" : "Practice on five different spots"} data={progress.transfer} ja={ja} />}
      {progress.transferRetest && <Summary title={ja ? "新しい5局面での再測定結果" : "Retest on five new spots"} data={progress.transferRetest} ja={ja} />}
      {review && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={actionStyle} onClick={() => onReplay(review.handId, { handId: review.handId, actionSeqStart: review.actionSeq, actionSeqEnd: review.actionSeq })}>{ja ? "自分の3rdドローを見返す" : "Replay your third draw"}</button>
        <button type="button" className={actionStyle} onClick={() => setReviewRange(reviewRange ? null : review.range)}>{ja ? "自分の局面を仮定別に比較" : "Compare your spot under modeled ranges"}</button>
      </div>}
      {reviewQuestion && <div className="mt-3 rounded-xl border border-white/10 p-3">
        <Spot question={reviewQuestion} ja={ja} />
        <label className="mt-3 block text-sm">{ja ? "想定レンジ" : "Modeled range"}
          <select className={field} value={reviewRange} onChange={(event) => setReviewRange(event.target.value)}>
            {Object.entries(RANGE_MODELS).map(([id, range]) => <option key={id} value={id}>{range[ja ? "ja" : "en"]}</option>)}
          </select>
        </label>
        <Results question={reviewQuestion} answer={reviewQuestion.actualAction} result={evaluateFinalDraw(reviewQuestion)} ja={ja} />
      </div>}
      {!progress.practice && <button type="button" className={`mt-3 ${actionStyle}`} onClick={() => start("practice")}>{ja ? "3rdドローを5問練習" : "Practice five third draws"}</button>}
      {progress.practice && <>
        <Summary title={ja ? "初回の練習セット" : "First practice set"} data={progress.practice} ja={ja} />
        <button type="button" className={`mt-3 ${actionStyle}`} onClick={() => start("repeat")}>{ja ? "練習を繰り返す" : "Repeat practice"}</button>
      </>}
      {progress.practice && !progress.retest && (eligible
        ? <button type="button" className={`mt-3 ${actionStyle}`} onClick={() => start("retest")}>{ja ? "未出題の5問で再測定" : "Retest on five unseen spots"}</button>
        : <p className="mt-3 text-sm text-slate-400">{ja ? "未出題の再測定" : "Unseen retest"} · {new Date(dueAt).toLocaleDateString(ja ? "ja-JP" : "en-US")}</p>)}
      {progress.retest && <Summary title={ja ? "未出題セットの再測定" : "Unseen retest"} data={progress.retest} ja={ja} />}
      {error && <p role="alert" className="mt-2 text-sm text-red-200">{ja ? "この端末に練習結果を保存できませんでした。" : "This device could not save the drill result."}</p>}
    </>}
  </section>;
}
