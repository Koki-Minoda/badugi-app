import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerProgress } from '../hooks/usePlayerProgress.js';
import { computeUnlockState } from '../utils/playerProgress.js';
import { getVariantById } from '../../games/config/variantCatalog.js';
import { useMixedGame } from '../mixed/useMixedGame.js';
import { isMixedVariantPlayable } from '../mixed/mixedAvailability.js';
import { DEFAULT_DEALER_CHOICE_POOL, enqueueDealerChoiceVariant, getDealerChoiceQueue, clearDealerChoiceQueue, setDealerChoiceModeActive } from '../dealersChoice/dealerChoiceManager.js';

const choices = DEFAULT_DEALER_CHOICE_POOL.filter(isMixedVariantPlayable).map(id => ({ id, name: getVariantById(id)?.name ?? id }));
export default function DealersChoiceScreen() {
  const ja=useLanguage()==='ja';
  const navigate = useNavigate();
  const { saveProfile } = useMixedGame();
  const locked = computeUnlockState(usePlayerProgress()).dealerChoiceLocked;
  const [selected, setSelected] = useState(choices[0].id);
  const [queue, setQueue] = useState(() => getDealerChoiceQueue().filter(isMixedVariantPlayable));
  const [spinning, setSpinning] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  const spin = () => {
    setSpinning(true);
    const end = Date.now() + 1500;
    timer.current = setInterval(() => {
      setSelected(choices[Math.floor(Math.random() * choices.length)].id);
      if (Date.now() >= end) { clearInterval(timer.current); setSpinning(false); }
    }, 100);
  };
  const launch = () => {
    if (locked || spinning) return;
    const games = queue.length ? queue : [selected];
    clearDealerChoiceQueue();
    games.forEach(enqueueDealerChoiceVariant);
    const profile = saveProfile({ id: 'dealers-choice-session', name: "Dealer’s Choice", selectedGameIds: games, handsPerGame: 1, selectionMode: 'FIXED', allowDuplicates: true });
    setDealerChoiceModeActive(true);
    navigate('/game?mode=dealers-choice', { state: { mixedProfileId: profile.id, dealerChoice: true } });
  };
  return <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:p-8">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-emerald-300">{ja ? '1ハンドごとに種目交代' : 'Change games after each hand'}</p><h1 className="text-2xl font-bold">Dealer’s Choice</h1><LanguageSelect /></div><button className="min-h-11 rounded-xl border border-white/20 px-4" onClick={() => navigate('/games')}>{ja ? 'ゲーム選択へ' : 'Choose a game'}</button></header>
      <p className="text-sm leading-relaxed text-slate-300">{ja ? '遊ぶ種目を選ぶか、ルーレットで決めてください。追加した順に1ハンドずつプレイし、最後まで進むと先頭から繰り返します。' : 'Choose each game yourself or use the roulette. Play one hand per queued game, then repeat the queue.'}</p>
      {locked && <p role="status" className="rounded-xl bg-amber-500/10 p-4 text-amber-100">{ja ? 'World Championshipで優勝すると利用できます。' : 'Win the World Championship to unlock this mode.'}</p>}
      <section className="rounded-2xl border border-white/15 bg-slate-900 p-4 sm:p-6">
        <label className="block space-y-2"><span className="font-semibold">{ja ? '遊ぶ種目' : 'Game to play'}</span><select aria-label={ja?'遊ぶ種目':'Game to play'} value={selected} onChange={e => setSelected(e.target.value)} disabled={locked || spinning} className="min-h-12 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-base">{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="mt-3 grid grid-cols-2 gap-3"><button data-testid="roulette-spin" disabled={locked || spinning} onClick={spin} className="min-h-12 rounded-xl border border-emerald-300/40 px-3 disabled:opacity-40">{spinning ? (ja?'選択中…':'Choosing…') : (ja?'ルーレットで選ぶ':'Choose randomly')}</button><button data-testid="roulette-add" disabled={locked || spinning || queue.length >= 24} onClick={() => setQueue(enqueueDealerChoiceVariant(selected))} className="min-h-12 rounded-xl bg-emerald-700 px-3 font-semibold disabled:opacity-40">{ja ? 'プレイ順に追加' : 'Add to play order'}</button></div>
      </section>
      <section className="rounded-2xl border border-white/15 p-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{ja ? 'プレイ順' : 'Play order'}</h2><button data-testid="roulette-clear" disabled={!queue.length} onClick={() => { setQueue(clearDealerChoiceQueue()); setDealerChoiceModeActive(false); }} className="min-h-11 px-3 text-sm text-slate-300 disabled:opacity-40">{ja?'クリア':'Clear'} ({queue.length})</button></div>
        {queue.length ? <ol className="mt-2 grid gap-2 sm:grid-cols-2">{queue.map((id, i) => <li key={`${i}-${id}`} className="rounded-lg bg-slate-900 p-3"><span className="mr-3 text-emerald-300">{i + 1}</span>{getVariantById(id)?.name ?? id}</li>)}</ol> : <p className="py-3 text-sm text-slate-400">{ja ? '追加しなくても、選択中の種目ですぐ遊べます。' : 'You can start the selected game without adding a queue.'}</p>}
      </section>
      <button data-testid="roulette-launch" disabled={locked || spinning} onClick={launch} className="min-h-12 w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-40">{queue.length ? (ja?`${queue.length}種目をこの順でスタート`:`Start ${queue.length} games in this order`) : (ja?'このゲームですぐスタート':'Start this game')}</button>
    </div>
  </main>;
}
