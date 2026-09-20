import React, { useEffect, useState } from 'react';
import { LEARNING_GAMES } from '../learning/learningCatalog.js';
import RuleCard from '../learning/RuleCard.jsx';
import { CLOCK_KEY, readClock, advanceClock, toggleClock, newClock, validateClock } from './tableClock.js';
const field = 'min-h-11 w-full rounded-lg bg-slate-800 p-2 text-base';
export default function TableClock({ ja }) {
  const [clock, setClock] = useState(readClock);
  const [error, setError] = useState('');
  const [breakDraft,setBreakDraft]=useState({breakEvery:clock.breakEvery,breakMinutes:clock.breakMinutes});
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(clock.levels)));
  const active = clock.deadline !== null;
  useEffect(() => {
    const refresh = () => setClock(previous => advanceClock(previous));
    const interval = setInterval(refresh, 250);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => { try { localStorage.setItem(CLOCK_KEY, JSON.stringify(clock)); } catch { setError(ja ? '時計を保存できません。この画面を閉じると設定を失う場合があります。' : 'The clock could not be saved. Keep this page open to retain it.'); } }, [clock, ja]);
  const current = clock.levels[clock.index];
  const next = clock.levels[clock.index + 1];
  const game = LEARNING_GAMES.find(g => g.id === clock.gameId) ?? LEARNING_GAMES[0];
  const stud = /^(stud|razz)/.test(game.id);
  const bets = level => stud ? `Ante ${level.ante} · Bring-in ${level.bringIn ?? level.sb} · ${ja ? 'ベット' : 'Bets'} ${level.smallBet ?? level.bb}/${level.bigBet ?? level.bb*2}` : `SB ${level.sb} / BB ${level.bb} · Ante ${level.ante}`;
  const seconds = Math.ceil(clock.remainingMs / 1000);
  const digits = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  function reset(preset) { const value = newClock(preset); setClock(value); setBreakDraft({breakEvery:value.breakEvery,breakMinutes:value.breakMinutes}); setDraft(value.levels.map(l => ({ ...l }))); setError(''); }
  return <section className="space-y-5">
    <p className="text-sm text-slate-300">{ja ? 'リアル卓用の時計です。アプリ内の対局や大会とは連動しません。画面を閉じている間も進みます。一時停止すると残り時間を保持します。' : 'A clock for a live table, separate from in-app games. It keeps running when the page is closed; pause it to hold the remaining time.'}</p>
    <label className="block">{ja ? 'ゲーム札' : 'Game sign'}<select className={field} value={game.id} onChange={e => setClock({ ...clock, gameId: e.target.value })}>{LEARNING_GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <div className="rounded-3xl border border-emerald-300/40 bg-emerald-950 p-5 text-center landscape:grid landscape:grid-cols-2 landscape:items-center landscape:gap-5">
      <div><h2 className="text-3xl font-bold sm:text-5xl">{game.name}</h2><p className="mt-3 text-xl">{clock.ended ? (ja ? '最終レベル終了' : 'Final level complete') : clock.phase === 'break' ? (ja ? '休憩' : 'Break') : `Level ${clock.index + 1}`}</p></div>
      <div><p className="my-4 font-mono text-6xl font-bold tabular-nums sm:text-8xl" aria-label={ja ? '残り時間' : 'Time remaining'}>{digits}</p><p className="text-xl">{bets(current)}</p>{!stud && game.betting === 'fixed-limit' && <p className="mt-2">{ja ? 'ベット単位' : 'Bet sizes'} {current.bb} / {current.bb * 2}</p>}<p className="mt-2 text-sm text-emerald-200">{next ? `${ja ? '次' : 'Next'}: ${bets(next)}` : (ja ? 'これが最終レベルです' : 'This is the final level')}</p></div>
    </div>
    <p className="text-sm text-slate-300">{ja ? 'Studはアンティ・ブリングイン・小さいベット・大きいベットを表示します。卓のルールに合わせて編集できます。' : 'For Stud, edit ante, bring-in, small bet and big bet to match your table rules.'}</p>
    <button type="button" disabled={clock.ended} onClick={() => setClock(previous => toggleClock(previous))} className="min-h-12 w-full rounded-xl bg-emerald-300 p-3 font-bold text-slate-950 disabled:opacity-40">{active ? (ja ? '一時停止' : 'Pause') : (ja ? '時計を開始・再開' : 'Start / resume clock')}</button>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    <details className="rounded-xl border border-white/20 p-3"><summary className="min-h-11 cursor-pointer py-2">{ja ? 'ストラクチャーを編集' : 'Edit structure'}</summary><p className="my-3 text-sm">{ja ? '停止中に変更できます。適用するとレベル1から始め直します。' : 'Edit while paused. Applying a structure resets the clock to level 1.'}</p><div className="flex flex-wrap gap-2">{[['short','短め','Short'],['standard','標準','Standard'],['long','じっくり','Long']].map(([id,jp,en]) => <button type="button" key={id} disabled={active} className="min-h-11 rounded border border-white/25 px-3 disabled:opacity-30" onClick={() => reset(id)}>{ja ? jp : en}</button>)}</div>
      <div className="my-3 grid grid-cols-2 gap-3"><label>{ja ? '休憩を挟むレベル数（0でなし）' : 'Break every levels (0 = none)'}<input className={field} type="number" min="0" max="60" disabled={active} value={breakDraft.breakEvery} onChange={e => setBreakDraft({ ...breakDraft, breakEvery: Number(e.target.value) })} /></label><label>{ja ? '休憩（分）' : 'Break (minutes)'}<input className={field} type="number" min="1" max="60" disabled={active} value={breakDraft.breakMinutes} onChange={e => setBreakDraft({ ...breakDraft, breakMinutes: Number(e.target.value) })} /></label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[320px] text-sm"><thead><tr>{(stud ? ['Lv','Bring-in','Small','Big','Ante',ja ? '分' : 'Min'] : ['Lv','SB','BB','Ante',ja ? '分' : 'Min']).map(t => <th key={t} className="p-1 text-left">{t}</th>)}</tr></thead><tbody>{draft.map((level, index) => <tr key={index}><th>{index + 1}</th>{(stud ? ['bringIn','smallBet','bigBet','ante','minutes'] : ['sb','bb','ante','minutes']).map(key => <td key={key} className="p-1"><input aria-label={`Level ${index + 1} ${key}`} className={`${field} min-w-0`} type="number" min={key === 'bb' || key === 'minutes' ? 1 : 0} disabled={active} value={level[key] ?? (key === 'bringIn' ? level.sb : key === 'smallBet' ? level.bb : level.bb*2)} onChange={e => setDraft(draft.map((row,i) => i === index ? { ...row, [key]: Number(e.target.value) } : row))} /></td>)}</tr>)}</tbody></table></div>
      <button type="button" disabled={active} className="mt-3 min-h-11 rounded bg-emerald-300 px-4 font-bold text-slate-950 disabled:opacity-30" onClick={() => { try { const nextClock = validateClock({ ...clock, ...breakDraft, levels: draft.map(l => ({ ...l })), index: 0, phase: 'level', deadline: null, remainingMs: draft[0].minutes * 60000, ended: false }); setClock(nextClock); setError(''); } catch { setError(ja ? '数値を確認してください。BBはSB以上、レベルは1〜120分です。' : 'Check the values. BB must be at least SB; levels last 1–120 minutes.'); } }}>{ja ? 'この設定を適用' : 'Apply structure'}</button>
    </details><RuleCard variantId={game.id} language={ja ? 'ja' : 'en'} />
  </section>;
}
