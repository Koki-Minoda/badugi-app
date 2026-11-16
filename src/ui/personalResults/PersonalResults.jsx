import React, { useMemo, useState } from "react";
import { getPersonalResults, HAND_WINDOW, MIN_DECISIONS } from "./handProgress.js";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4";
const control = "rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10";
const axesJa = ["1回目の交換", "2回目の交換", "3回目の交換", "参加判断", "パット判断", "相手の読み", "位置取り", "ベット対応", "バリュー", "ブラフ"];
const axesEn = ["Draw 1", "Draw 2", "Draw 3", "Entry", "Pat decision", "Opponent reads", "Position", "Bet response", "Value", "Bluff"];
const scale = [1, 2, 3, 4, 5];

function Plot({ children, label }) {
  return <svg viewBox="0 0 360 245" className="mt-3 w-full overflow-visible" role="img" aria-label={label}>{children}</svg>;
}

function Grid({ max, xLabel, yLabel }) {
  return <>
    {[0, 2, 4, 6, 8, 10].map((n) => <g key={n}>
      <path d={`M40 ${200 - n * 17}H330`} stroke="#334155" strokeWidth="1" />
      <text x="33" y={204 - n * 17} textAnchor="end" fill="#94a3b8" fontSize="10">{n}</text>
    </g>)}
    {[0, 1, 2, 3, 4].map((step) => <text key={step} x={40 + step * 72.5} y="217" textAnchor="middle" fill="#94a3b8" fontSize="10">{Math.round(max * step / 4)}</text>)}
    <text x="40" y="15" fill="#cbd5e1" fontSize="11">{yLabel}</text>
    <text x="185" y="237" textAnchor="middle" fill="#cbd5e1" fontSize="11">{xLabel}</text>
  </>;
}

function Scatter({ games, selected, choose, ja }) {
  const max = Math.max(100, Math.ceil(Math.max(0, ...games.map((game) => game.hands)) / 100) * 100);
  return <section className={panel}>
    <h2 className="font-semibold">{ja ? "全ゲームの結果" : "All games"}</h2>
    <p className="mt-1 text-xs text-slate-400">{ja ? "この端末に残っている対局履歴から集計" : "Based on the hand history available on this device"}</p>
    {games.some((game) => game.score != null) && <Plot label={ja ? "経験量と測定済みの習熟度の散布図" : "Hands and measured scores"}>
      <Grid max={max} xLabel={ja ? "完了ハンド数" : "Completed hands"} yLabel={ja ? "習熟度（測定済み項目）" : "Measured skill score"} />
      {games.filter((game) => game.score != null).map((game) => {
        const x = 40 + 290 * game.hands / max;
        return <g key={game.id} className="cursor-pointer" onClick={() => choose(game.id)}>
          <circle cx={x} cy={200 - 17 * game.score} r={selected === game.id ? 7 : 5} fill="#6ee7b7" />
          <text x={x} y={186 - 17 * game.score} textAnchor={x > 275 ? "end" : "middle"} fill="#e2e8f0" fontSize="11">{game.label}</text>
        </g>;
      })}
    </Plot>}
    <ul className="mt-3 space-y-1">
      {games.map((game) => <li key={game.id}>
        <button type="button" aria-pressed={selected === game.id} onClick={() => choose(game.id)} className="flex w-full justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/5 aria-pressed:bg-emerald-900/30">
          <span>{game.label}</span><span>{game.hands} {ja ? "ハンド" : "hands"} · {game.score == null ? (ja ? "未測定" : "Unmeasured") : `${game.score}/10`}</span>
        </button>
      </li>)}
    </ul>
  </section>;
}

function radarPoint(index, value) {
  const angle = Math.PI * (index / 5 - 0.5);
  return [180 + Math.cos(angle) * value * 8.6, 128 + Math.sin(angle) * value * 8.6];
}

function Radar({ axes, ja }) {
  const labels = ja ? axesJa : axesEn;
  return <>
    <svg viewBox="0 0 360 257" className="mt-3 w-full" role="img" aria-label={ja ? "項目別の習熟度レーダー" : "Skill radar"}>
      {[2, 4, 6, 8, 10].map((n) => <polygon key={n} points={labels.map((_, i) => radarPoint(i, n).join(",")).join(" ")} fill="none" stroke="#334155" />)}
      {labels.map((label, i) => {
        const [x, y] = radarPoint(i, 10);
        const [lx, ly] = radarPoint(i, 11.2);
        const point = axes[i]?.score == null ? null : radarPoint(i, axes[i].score);
        const prior = axes[i]?.baseline == null ? null : radarPoint(i, axes[i].baseline);
        return <g key={label}>
          <path d={`M180 128L${x} ${y}`} stroke="#334155" />
          <text x={lx} y={ly} textAnchor={lx < 175 ? "end" : lx > 185 ? "start" : "middle"} dominantBaseline="middle" fill={point ? "#d1fae5" : "#94a3b8"} fontSize="10">{label}</text>
          {prior && <circle cx={prior[0]} cy={prior[1]} r="4" fill="#020617" stroke="#94a3b8" strokeWidth="2" />}
          {point && <circle cx={point[0]} cy={point[1]} r="4.5" fill="#6ee7b7" />}
        </g>;
      })}
    </svg>
    {axes.some((axis) => axis.baseline != null) && <p className="mb-2 flex gap-4 text-xs text-slate-400">
      <span>{ja ? "○ 初回50ハンド" : "○ First 50 hands"}</span><span className="text-emerald-300">{ja ? "● 直近50ハンド" : "● Latest 50 hands"}</span>
    </p>}
    <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-300">
      {labels.map((label, i) => <li key={label}>{label} <span className="text-slate-400">{axes[i]?.score == null ? (ja ? "未測定" : "Unmeasured") : `${axes[i].baseline == null ? "" : `${axes[i].baseline} → `}${axes[i].score}/10 · ${axes[i].samples}${ja ? "件" : " decisions"}`}</span></li>)}
    </ul>
  </>;
}

function Timeline({ game, ja }) {
  const scoreLabel = ja ? "カード選択 / 10" : "Card selection / 10";
  const handLabel = ja ? "種目内のハンド番号" : "Hand number within game";
  const x = (point) => 40 + 290 * point.end / game.hands;
  const y = (point) => 200 - 17 * point.score;
  return <section className={panel}>
    <h2 className="font-semibold">{ja ? "成長の軌跡" : "Progress over time"}</h2>
    <p className="mt-1 text-xs text-slate-400">{ja ? `${HAND_WINDOW}ハンドごと・各区間で評価対象が${MIN_DECISIONS}件以上の場合に表示` : `Windows of ${HAND_WINDOW} hands, with at least ${MIN_DECISIONS} scored choices each`}</p>
    <Plot label={ja ? "ハンド数に沿ったカード選択スコア" : "Card selection over completed hands"}>
      <Grid max={game.hands} xLabel={handLabel} yLabel={scoreLabel} />
      {game.timeline.map((point, i) => {
        if (point.score == null) return null;
        const prior = game.timeline[i - 1];
        return <g key={point.end}>
          {prior?.score != null && <path d={`M${x(prior)} ${y(prior)}L${x(point)} ${y(point)}`} stroke="#6ee7b7" strokeWidth="2" />}
          <circle cx={x(point)} cy={y(point)} r="3.5" fill="#6ee7b7" />
        </g>;
      })}
    </Plot>
    <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">{ja ? "区間ごとのスコアと件数" : "Scores and counts by window"}</summary>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {game.timeline.map((point) => <li key={point.end}>{point.start}–{point.end} · {point.score == null ? "—" : `${point.score}/10`} · {point.samples}{ja ? "件" : " decisions"}</li>)}
      </ul>
    </details>
  </section>;
}

function getUserId() {
  try { return JSON.parse(localStorage.getItem("mgx_auth"))?.user?.id ?? null; } catch { return null; }
}

function Impressions({ game, ja, userId }) {
  const key = userId == null ? null : `mgx.personalResults.impressions.v1:${userId}:${game.id}`;
  const [history, setHistory] = useState(() => {
    if (!key) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const last = history.at(-1);
  const due = !last || Date.now() - last.at >= 90 * 86400000;
  const [open, setOpen] = useState(due);
  const [like, setLike] = useState(last?.like ?? "");
  const [confidence, setConfidence] = useState(last?.confidence ?? "");
  const [error, setError] = useState(false);
  if (!key) return null;
  const save = (event) => {
    event.preventDefault();
    const next = [...history, { like: Number(like), confidence: Number(confidence), at: Date.now() }];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setHistory(next);
      setOpen(false);
      setError(false);
    } catch { setError(true); }
  };
  const liking = ja ? "好き嫌い" : "Preference";
  const ability = ja ? "得意意識" : "Confidence";
  return <section className={panel}>
    <h2 className="font-semibold">{ja ? "今の印象" : "Current impressions"}</h2>
    {last && <p className="mt-2 text-sm text-slate-300">{liking} {last.like}/5 · {ability} {last.confidence}/5</p>}
    {due && last && <p className="mt-2 text-xs text-slate-400">{ja ? "前回の回答から約3か月" : "About three months since the last response"}</p>}
    {open ? <form className="mt-3 space-y-3" onSubmit={save}>
      <label className="block text-sm">{liking} {ja ? "（1 嫌い / 5 好き）" : "(1 dislike / 5 like)"}
        <select value={like} onChange={(event) => setLike(event.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2"><option value="">—</option>{scale.map((n) => <option key={n}>{n}</option>)}</select>
      </label>
      <label className="block text-sm">{ability} {ja ? "（1 苦手 / 5 得意）" : "(1 unsure / 5 confident)"}
        <select value={confidence} onChange={(event) => setConfidence(event.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2"><option value="">—</option>{scale.map((n) => <option key={n}>{n}</option>)}</select>
      </label>
      <button type="submit" className={control}>{ja ? "回答を保存" : "Save answers"}</button>
      <button type="button" className="ml-3 text-sm text-slate-300" onClick={() => setOpen(false)}>{ja ? "今はスキップ" : "Skip for now"}</button>
      {error && <p role="alert">{ja ? "回答を保存できませんでした。" : "Could not save your answers."}</p>}
    </form> : <button type="button" className={`mt-3 ${control}`} onClick={() => setOpen(true)}>{ja ? "印象を更新" : "Update impressions"}</button>}
  </section>;
}

export default function PersonalResults({ hands, onBack, onReplay, language }) {
  const ja = language === "ja";
  const userId = getUserId();
  const games = useMemo(() => getPersonalResults(hands, userId), [hands, userId]);
  const [selected, setSelected] = useState(() => games[0]?.id ?? "");
  const game = games.find((entry) => entry.id === selected) ?? games[0];
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
    <main className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs tracking-[0.4em] text-emerald-300">MGX</p><h1 className="text-2xl font-semibold">{ja ? "マイ結果" : "My results"}</h1></div>
        <button type="button" className={control} onClick={onBack}>{ja ? "ハンド履歴へ戻る" : "Back to hand history"}</button>
      </header>
      {!game ? <p className={panel}>{ja ? "完了した対局が記録されると、ここに表示されます。" : "Completed hands will appear here."}</p> : <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Scatter games={games} selected={game.id} choose={setSelected} ja={ja} />
          <Impressions key={game.id} game={game} ja={ja} userId={userId} />
        </div>
        <div className="space-y-4">
          <section className={panel}>
            <label className="block text-xs font-semibold text-slate-300">{ja ? "対象ゲーム" : "Game"}
              <select value={game.id} onChange={(event) => setSelected(event.target.value)} className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-white">
                {games.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <h2 className="mt-4 font-semibold">{ja ? "スキル別習熟度" : "Skill scores"}</h2>
            {game.id === "badugi" ? <><Radar axes={game.axes} ja={ja} />
              <p className="mt-3 text-xs text-slate-400">{ja ? "直近50ハンドの交換で、同じ枚数を残す中で最も強い組み合わせを選べた割合です。" : "Last 50 hands. Share of draws that kept the strongest combination of the chosen size."}</p>
            </> : <p className="mt-2 text-sm text-slate-400">{ja ? "この種目の判断は未測定です。" : "This game's decisions are not yet scored."}</p>}
          </section>
          {game.review && <section className={panel}>
            <h2 className="font-semibold">{ja ? "次に見直す局面" : "Next spot to review"}</h2>
            <p className="my-2 text-sm text-slate-300">{ja ? `${game.review.round + 1}回目の交換。残す枚数をそろえて、スート・ランクの重複と高い札を確認しましょう。` : `Draw ${game.review.round + 1}. Compare combinations of the same size for duplicate suits, ranks and high cards.`}</p>
            <button type="button" className={control} onClick={() => onReplay(game.review.handId, { handId: game.review.handId, actionSeqStart: game.review.seq, actionSeqEnd: game.review.seq })}>{ja ? "この対局を見返す" : "Review this hand"}</button>
          </section>}
          {game.timeline.some((point) => point.score != null) && <Timeline game={game} ja={ja} />}
        </div>
      </div>}
    </main>
  </div>;
}
