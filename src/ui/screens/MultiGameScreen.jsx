import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerProgress } from '../hooks/usePlayerProgress.js';
import { computeUnlockState } from '../utils/playerProgress.js';
import { PUBLIC_RING_PLAYABLE_VARIANTS } from '../../games/config/variantAvailability.js';
import { loadActiveMTTSnapshot } from '../tournament/tournamentManager.js';
import { MULTI_FORMATS, loadMultiGameSeries, createMultiGameSeries, buildMultiGameConfig } from '../multigame/multiGameSeries.js';
export default function MultiGameScreen() {
  const navigate=useNavigate();const locked=computeUnlockState(usePlayerProgress()).multiGameLocked;
  const [format,setFormat]=useState('stage'),[sequence,setSequence]=useState(['badugi','deuce_to_seven_triple_draw','stud']),[finalGame,setFinalGame]=useState('nlh');
  const [series,setSeries]=useState(loadMultiGameSeries),[error,setError]=useState('');
  const active=loadActiveMTTSnapshot();
  const unfinished=active && !active.tournamentState?.isFinished;
  const start=()=>{try { if(locked)return; if(unfinished){setError('進行中の大会があります。再開して終了するか、大会メニューでリタイアしてください。');return;}const s=createMultiGameSeries(format,sequence,[finalGame,...sequence]);setSeries(s);navigate('/game',{state:{multiGameConfig:buildMultiGameConfig(s)}});}catch(e){setError(e.message);}};
  const continueSeries=()=>{ if (unfinished && active.config?.multiGame?.seriesId!==series.id) {setError('別の大会が進行中です。大会メニューで再開して終了するか、リタイアしてください。');return;}navigate('/game',{state:unfinished ? {multiGameResume:true}:{multiGameConfig:buildMultiGameConfig(series)}}); };
  return <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-8"><div className="mx-auto max-w-4xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-emerald-300">複数種目のトーナメント</p><h1 className="text-2xl font-bold">Multi-Game Tournament</h1></div><button onClick={()=>navigate('/games')} className="min-h-11 rounded-lg border border-white/20 px-4">ゲーム選択へ</button></header>
    {locked && <p role="status" className="rounded-xl bg-amber-500/10 p-4 text-amber-100">World Championshipで優勝すると利用できます。</p>}
    {series && <section data-testid="multi-series-progress" className="rounded-2xl border border-emerald-300/30 bg-emerald-950/30 p-4"><h2 className="font-bold">{MULTI_FORMATS[series.format].name} · {series.completed?'完了':`${series.results.length}/${series.format==='stage'?3:1}大会終了`}</h2>{series.results.length>0 && <ol className="my-3 space-y-1">{Object.values(series.standings).sort((a,b)=>b.points-a.points).map((p,i)=><li key={p.id}>{i+1}. {p.name} · {p.points}点</li>)}</ol>}{!series.completed && <button data-testid="multi-continue" onClick={continueSeries} className="mt-3 min-h-11 rounded-xl bg-emerald-400 px-4 font-bold text-slate-950">{unfinished?'進行中の大会を再開':'次の大会へ'}</button>}</section>}
    <section className="grid gap-3 md:grid-cols-3">{Object.entries(MULTI_FORMATS).map(([id,f])=><button key={id} data-testid={`multi-format-${id}`} disabled={locked} onClick={()=>setFormat(id)} aria-pressed={format===id} className={`rounded-2xl border p-4 text-left disabled:opacity-40 ${format===id?'border-emerald-300 bg-emerald-500/10':'border-white/15 bg-slate-900'}`}><h2 className="font-bold">{f.name}</h2><p className="mt-2 text-sm leading-relaxed text-slate-300">{f.description}</p></button>)}</section>
    <section className="space-y-3 rounded-2xl border border-white/15 bg-slate-900 p-4"><h2 className="font-bold">プレイする3種目</h2><div className="grid gap-3 sm:grid-cols-3">{sequence.map((id,i)=><label key={i} className="space-y-1 text-sm"><span>{i+1}種目目</span><select aria-label={`${i+1}種目目`} value={id} disabled={locked} onChange={e=>setSequence(sequence.map((v,j)=>j===i?e.target.value:v))} className="min-h-12 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-base">{PUBLIC_RING_PLAYABLE_VARIANTS.map(v=><option key={v.id} value={v.availabilityKey}>{v.displayName}</option>)}</select></label>)}</div>{format==='championship' && <label className="block space-y-1 text-sm"><span>決勝Dealer’s Choiceの先頭（以後は選んだ3種目）</span><select aria-label="決勝の先頭種目" value={finalGame} onChange={e=>setFinalGame(e.target.value)} className="min-h-12 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-base">{PUBLIC_RING_PLAYABLE_VARIANTS.map(v=><option key={v.id} value={v.availabilityKey}>{v.displayName}</option>)}</select></label>}<p className="text-sm text-slate-300">参加費なし。シリーズの順位点はこの端末に保存されます。通常大会の賞金や解放条件には加算しません。</p></section>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    <button data-testid="multi-start" disabled={locked || (!!series && !series.completed)} onClick={start} className="min-h-12 w-full rounded-xl bg-emerald-400 px-4 font-bold text-slate-950 disabled:opacity-40">{MULTI_FORMATS[format].name}を開始</button>
    <p className="text-xs text-slate-400">自分の卓は通常のゲーム操作で進行します。他の卓は既存の大会シミュレーションで進行します。中断後は直前のハンド終了時点から再開します。</p>
  </div></main>;
}
