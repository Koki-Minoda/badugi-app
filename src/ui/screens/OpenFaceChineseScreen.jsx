import React, { useRef, useState } from 'react';
import {TableCard} from './layouts/MobileTableSeat.jsx';
import '../../styles/mobile-table.css';
import OpenFaceChineseController, { replayOfcHistory } from '../../games/chinese/OpenFaceChineseController.js';
import { OFC_ROWS } from '../../games/chinese/ofcRules.js';
const SESSION = 'mgx.ofc.session.v1';
export const OFC_HISTORY = 'mgx.ofc.history.v1';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const labels = { front: 'フロント · 3枚 · 弱', middle: 'ミドル · 5枚', back: 'バック · 5枚 · 強' };
function resume() {
  const saved = read(SESSION, null);
  try {
    if (saved?.version === 1) {
      const c = new OpenFaceChineseController({ deck: saved.deck, ...saved.initial, handNumber: saved.handNumber - 1 }); c.startNewHand();
      for (const e of saved.events.filter(e => e.type === 'PLACE')) c.place(e.seat, e.placement);
      c.handId = saved.handId; c.sourceDeck = null;
      return c;
    }
  } catch { /* An incomplete/corrupt local save does not prevent a new table. */ }
  const c = new OpenFaceChineseController(); c.startNewHand(); return c;
}
function save(c) { localStorage.setItem(SESSION, JSON.stringify({ version: 1, handId: c.handId, handNumber: c.handNumber, deck: c.deck, initial: c.initial, events: c.events })); }
function Card({ card, onClick, selected, testId }) {
  return <TableCard card={card} onClick={onClick} selected={selected} testId={testId} />;
}
export default function OpenFaceChineseScreen({ onBack }) {
  const ref = useRef(null);
  if (!ref.current) { ref.current = resume(); ref.current.playCpuTurns(); }
  const c = ref.current;
  const [state, setState] = useState(() => c.snapshot());
  const [draft, setDraft] = useState([]), [selected, setSelected] = useState(null), [error, setError] = useState('');
  const [history, setHistory] = useState(() => read(OFC_HISTORY, []));
  const [replay, setReplay] = useState(null), [frame, setFrame] = useState(0);
  const hero = state.players[0], cpu = state.players[1];
  const pending = hero.pending.filter(card => !draft.some(d => d.card === card));
  const activeCard = pending.includes(selected) ? selected : pending[0];
  const finished = state.phase === 'showdown';
  const update = () => { c.playCpuTurns(); save(c); setState(c.snapshot()); setDraft([]); setSelected(null); if (c.phase === 'showdown') { const record = c.history(); const next = [record, ...read(OFC_HISTORY, []).filter(h => h.handId !== record.handId)].slice(0, 50); localStorage.setItem(OFC_HISTORY, JSON.stringify(next)); setHistory(next); } };
  const place = row => {
    if (!activeCard || hero.rows[row].length + draft.filter(d => d.row === row).length >= OFC_ROWS[row]) return;
    setDraft([...draft, { card: activeCard, row }]); setSelected(null);
  };
  const commit = () => { try { c.place(0, draft); setError(''); update(); } catch (e) { setError(e.message); } };
  const next = () => { c.startNewHand(); update(); };
  const rowView = (player, editable) => <div className="space-y-2">{Object.keys(OFC_ROWS).map(row => {
    const additions = editable ? draft.filter(d => d.row === row).map(d => d.card) : [];
    const cards = [...player.rows[row], ...additions];
    const hidden = player.seat === 1 && player.fantasy && !finished;
    return <div key={row} className="rounded-xl border border-white/10 bg-slate-950/70 p-2"><div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-300"><span>{labels[row]}</span><span>{cards.length}/{OFC_ROWS[row]}</span></div><div className="flex flex-wrap gap-1">{cards.map(card => hidden ? <span key={card} className="flex min-h-14 w-10 items-center justify-center rounded-lg bg-indigo-950 text-indigo-300">?</span> : <Card key={card} card={card} selected={additions.includes(card)} onClick={additions.includes(card) ? () => setDraft(draft.filter(d => d.card !== card)) : null} />)}{!cards.length && <span className="flex h-14 items-center text-xs text-slate-500">未配置</span>}</div>{editable && !finished && <button data-testid={`ofc-place-${row}`} disabled={!activeCard || cards.length >= OFC_ROWS[row]} onClick={() => place(row)} className="mt-2 min-h-11 w-full rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 text-sm font-semibold text-emerald-100 disabled:opacity-30">{activeCard ? `${activeCard} を配置` : '配置先'}</button>}</div>;
  })}</div>;
  return <main data-testid="ofc-screen" className="mgx-arrange-page min-h-screen bg-slate-950 px-3 pb-36 pt-4 text-white sm:px-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-emerald-300">CLASSIC OFC · 最初に5枚、以後1枚ずつ</p><h1 className="text-2xl font-bold">Open-Face Chinese Poker</h1><p className="mt-1 text-sm text-slate-300">ハンド #{state.handNumber} · {finished ? '結果' : hero.fantasy ? 'Fantasyland · 13枚を配置' : `配置 ${state.street + 1}/9`} · 累計 {state.scores[0]}点</p></div><button onClick={() => { save(c); onBack(); }} className="min-h-11 rounded-lg border border-white/20 px-4">保存してゲーム選択へ</button></header>
      <details className="rounded-xl border border-white/15 p-3 text-sm text-slate-300"><summary className="cursor-pointer py-1 font-semibold">遊び方・得点・Fantasyland</summary><p className="mt-2">フロント3枚 ≤ ミドル5枚 ≤ バック5枚の強さにします。確定したカードは動かせません。相手と各行を比較して1点、3行すべて勝つと追加3点。ファウルは6点と相手のロイヤリティを失います。</p><p className="mt-2">フロントQQ以上で次のハンドは13枚を一度に配置。継続条件はフロントのスリーカード、ミドルのフルハウス以上、またはバックのフォーカード以上。ファウルでは入場・継続できません。</p><p className="mt-2">ロイヤリティ：バックのストレート/フラッシュ/フルハウス/フォーカード/SF/ロイヤルは2/4/6/10/15/25点。ミドルはその2倍、スリーカードは2点。フロントは66から1点ずつ、スリーカードは222の10点からAAAの22点まで。</p></details>
      {finished && <section data-testid="ofc-result" className="rounded-2xl border border-emerald-300/40 bg-emerald-900/20 p-4"><h2 className="text-xl font-bold">今回 {state.result.points[0] >= 0 ? '+' : ''}{state.result.points[0]}点</h2><p>{state.result.evaluations[0].foul ? 'ファウル：3段の強さの順を確認してください' : `ロイヤリティ ${state.result.evaluations[0].royalties.total}点`} · 相手 {state.result.evaluations[1].foul ? 'ファウル' : `ロイヤリティ ${state.result.evaluations[1].royalties.total}点`}</p><p>{state.result.nextFantasy[0] ? '次のハンドはFantasylandです' : '次のハンドは通常の5枚配布から開始します'}</p><p data-testid="ofc-replay-integrity" className="mt-2 text-sm text-emerald-200">{replayOfcHistory(c.history()).valid ? '全配置・得点の再現を確認済み' : '履歴の整合性を確認できません'}</p></section>}
      <div className="grid gap-4 md:grid-cols-2"><section className="space-y-2"><h2 className="font-bold">あなた {hero.fantasy ? '· Fantasyland' : ''}</h2>{rowView(hero, true)}</section><section className="space-y-2"><h2 className="font-bold">Mina {cpu.fantasy ? '· Fantasyland（結果まで非公開）' : ''}</h2>{rowView(cpu, false)}</section></div>
      <details className="rounded-xl border border-white/15 p-3"><summary className="cursor-pointer py-1">履歴・配置リプレイ（{history.length}ハンド）</summary><div className="mt-3 flex flex-wrap gap-2">{history.slice(0, 10).map(h => <button key={h.handId} onClick={() => { setReplay(h); setFrame(0); }} className="min-h-11 rounded-lg border border-white/20 px-3">#{h.handNumber} · {h.result.points[0]}点</button>)}</div>{replay && <section className="mt-3 space-y-2" data-testid="ofc-replay"><p>{replayOfcHistory(replay).valid ? '検証済み' : '不整合'} · 配置 {frame}/{replay.events.filter(e => e.type === 'PLACE').length}</p><input type="range" min="0" max={replay.events.filter(e => e.type === 'PLACE').length} value={frame} onChange={e => setFrame(Number(e.target.value))} aria-label="配置リプレイの手順" className="min-h-11 w-full"/><ol className="space-y-1 text-sm">{replay.events.filter(e => e.type === 'PLACE').slice(0, frame).map((e, i) => <li key={i}>{e.seat ? 'Mina' : 'あなた'}：{e.placement.map(p => `${p.card}→${labels[p.row].split(' · ')[0]}`).join('、')}</li>)}</ol></section>}</details>
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>
    <footer data-testid="ofc-actions" className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-300/30 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto max-w-5xl space-y-2">{finished ? <><p role="status" data-testid="ofc-result-summary" className="text-center text-sm font-bold text-emerald-100">今回 {state.result.points[0] >= 0 ? '+' : ''}{state.result.points[0]}点 · {hero.evaluation?.foul || state.result.evaluations[0].foul ? 'ファウル' : '配置完了'}</p><button data-testid="ofc-next" onClick={next} className="min-h-12 w-full rounded-xl bg-emerald-400 px-4 font-bold text-slate-950">次のハンド</button></> : <><div className="flex items-center gap-3 overflow-x-auto"><p role="status" aria-live="polite" className="shrink-0 text-xs text-emerald-200">あなたの番<br/>あと{pending.length}枚を配置</p>{pending.map(card => <Card key={card} card={card} selected={card === activeCard} testId={`ofc-pending-${card}`} onClick={() => setSelected(card)} />)}</div><div className="grid grid-cols-3 gap-2"><button data-testid="ofc-suggest" onClick={() => setDraft(c.suggestPlacement(0))} className="min-h-11 rounded-xl border border-white/20 px-2 text-sm">おまかせ配置</button><button disabled={!draft.length} onClick={() => setDraft([])} className="min-h-11 rounded-xl border border-white/20 px-2 text-sm disabled:opacity-30">配置をやり直す</button><button data-testid="ofc-confirm" onClick={commit} disabled={pending.length > 0 || !draft.length} className="min-h-11 rounded-xl bg-emerald-400 px-2 text-sm font-bold text-slate-950 disabled:opacity-30">配置を確定</button></div></>}</div></footer>
  </main>;
}
