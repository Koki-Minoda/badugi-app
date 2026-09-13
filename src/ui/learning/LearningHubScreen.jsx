import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { canLaunchVariant } from '../../games/config/canLaunchVariant.js';
import { useMixedGame } from '../mixed/useMixedGame.js';
import { LEARNING_GAMES, LEARNING_PRESETS, getLearningGame, readLearningLanguage } from './learningCatalog.js';
import RuleCard from './RuleCard.jsx';
import { LANGUAGE_STORAGE_KEY } from '../../config/mgxLocaleConfig.js';
import LearningDashboard from './progress/LearningDashboard.jsx';

export default function LearningHubScreen() {
  const [params, setParams] = useSearchParams();
  const [language, setLanguage] = useState(readLearningLanguage);
  const [message, setMessage] = useState('');
  const { saveProfile, profiles } = useMixedGame();
  const ja = language === 'ja';
  const plan = LEARNING_PRESETS.find(p => p.id === params.get('plan'));
  const selected = getLearningGame(params.get('variant')) ?? getLearningGame(plan?.selectedGameIds[0]) ?? LEARNING_GAMES.find(g => g.catalogId === 'D02');
  const planIndex = plan?.selectedGameIds.indexOf(selected.catalogId) ?? -1;
  const previous = planIndex > 0 ? plan.selectedGameIds[planIndex - 1] : params.get('from');
  const gate = canLaunchVariant(selected.id);
  const selectVariant = game => setParams({ ...(plan ? { plan: plan.id } : {}), variant: game.id, from: selected.id });
  const savePlan = () => {
    const saved = profiles.find(profile => profile.id === plan.id)
      ?? saveProfile({ ...plan, description: plan.description[language] });
    // Provider retains an in-memory profile even when storage is unavailable.
    let persisted = false;
    try { persisted = JSON.parse(localStorage.getItem('mixedGameProfiles') ?? '[]').some(p => p.id === saved.id); } catch { /* Display memory-only status. */ }
    setMessage(persisted ? (ja ? 'この端末に保存しました。MIX設定で編集できます。' : 'Saved on this device. Edit it in MIX settings.') : (ja ? 'この画面で読み込みました。端末への保存はできませんでした。' : 'Loaded for this session; device storage was unavailable.'));
  };
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs tracking-widest text-emerald-300">MGX LEARN</p><h1 className="mt-2 text-3xl font-bold">{ja ? '種目を覚えて、プレイする' : 'Learn a game. Play a hand.'}</h1></div>
        <div className="flex items-center gap-4"><label className="text-sm">{ja ? '言語' : 'Language'} <select aria-label="Language" className="rounded bg-slate-800 p-2" value={language} onChange={e => { setLanguage(e.target.value); try { localStorage.setItem(LANGUAGE_STORAGE_KEY, e.target.value); } catch { /* Session-only language. */ } }}><option value="ja">日本語</option><option value="en">English</option></select></label><Link to="/menu" className="text-emerald-200 underline">{ja ? 'メニュー' : 'Menu'}</Link></div>
      </header>
      <p className="max-w-3xl text-slate-300">{ja ? '勝ち方・カード・手番を確認してから対局へ。練習プランでは前の種目との違いを確認できます。' : 'Review the winning hand, cards and action order before playing. A practice plan highlights what changes between games.'}</p>
      <LearningDashboard language={language} />
      <Link to="/learn/practice" className="block rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5">
        <span className="block text-lg font-bold">{ja ? '開始手札を決めて練習する' : 'Practice a starting hand'}</span>
        <span className="mt-2 block text-sm text-slate-300">{ja ? 'Badugi・A-5・2-7。自分の手札を選んで繰り返し練習できます。' : 'Badugi, A-5 and 2-7. Choose your cards and repeat a practice hand.'}</span>
      </Link>
      <Link to="/learn/review" className="block rounded-2xl border border-white/25 bg-slate-900 p-5">
        <span className="block text-lg font-bold">{ja ? '保存したハンドを復習する' : 'Review saved hands'}</span>
        <span className="mt-2 block text-sm text-slate-300">{ja ? '対局結果・履歴から保存したハンドにメモとタグを付けて振り返ります。' : 'Revisit hands saved from results or history, with your own notes and tags.'}</span>
      </Link>
      <Link to="/learn/quiz" className="block rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5">
        <span className="block text-lg font-bold">{ja ? 'クイズでルールを確認する' : 'Check your rules knowledge'}</span>
        <span className="mt-2 block text-sm text-slate-300">{ja ? 'A-5・2-7の役比較、Badugiの有効枚数、8以下のロー。1回6問。' : 'A-5 and 2-7 comparisons, Badugi card counts and eight-or-better low. Six questions.'}</span>
      </Link>
      <section aria-label={ja ? '目的別MIXテンプレート' : 'MIX practice templates'} className="grid gap-3 md:grid-cols-3">{LEARNING_PRESETS.map(p => <button key={p.id} type="button" aria-pressed={plan?.id === p.id} onClick={() => { setParams({ plan: p.id }); setMessage(''); }} className={`rounded-2xl border p-5 text-left ${plan?.id === p.id ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/20 bg-slate-900 hover:border-emerald-300'}`}>
        <span className="block text-lg font-bold">{p.title[language]}</span><span className="mt-2 block text-sm text-slate-300">{p.description[language]}</span><span className="mt-3 block text-xs text-emerald-200">{p.selectedGameIds.length}{ja ? '種目 · 各' : ' games · '}{p.handsPerGame}{ja ? 'ハンド／1巡' : ' hands each per rotation'}</span>
      </button>)}</section>
      {plan && <section className="space-y-3 rounded-2xl border border-emerald-400/30 p-4" aria-label={ja ? '練習する順番' : 'Practice order'}>
        <h2 className="font-bold">{ja ? '練習する順番' : 'Practice order'}</h2>
        <ol className="flex flex-wrap gap-2">{plan.selectedGameIds.map((id, index) => { const game = getLearningGame(id); return <li key={id}><button type="button" onClick={() => selectVariant(game)} aria-current={selected.id === game.id ? 'step' : undefined} className={`min-h-11 rounded-lg border px-3 text-sm ${selected.id === game.id ? 'border-emerald-300 bg-emerald-400/20' : 'border-white/20'}`}>{index + 1}. {game.name}</button></li>; })}</ol>
        <p className="text-sm text-slate-300">{ja ? '種目別に始めるか、MIX設定から連続プレイできます。公開前の種目は自動で飛ばします。MIXの解放条件は変わりません。' : 'Play a single game here or start a continuous session from MIX settings. Unreleased games are skipped. Existing MIX unlock requirements still apply.'}</p>
        <div className="flex flex-wrap gap-3"><button onClick={savePlan} type="button" className="min-h-11 rounded-lg bg-emerald-300 px-4 font-semibold text-slate-950">{ja ? 'テンプレートを保存' : 'Save template'}</button><Link to={`/mixed?preset=${plan.id}`} className="rounded-lg border border-white/25 px-4 py-3">{ja ? 'MIX設定で確認' : 'Review MIX settings'}</Link></div>
        {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
      </section>}
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,1fr)_2fr]">
        <section className="space-y-3"><h2 className="text-lg font-bold">{ja ? '種目から選ぶ' : 'Choose a game'}</h2><div className="grid grid-cols-2 gap-2 lg:grid-cols-1">{LEARNING_GAMES.map(game => <button key={game.id} type="button" onClick={() => selectVariant(game)} aria-pressed={selected.id === game.id} className={`min-h-11 rounded-xl border px-3 py-3 text-left text-sm ${selected.id === game.id ? 'border-emerald-300 bg-emerald-400/15' : 'border-white/15 bg-slate-900'}`}>{game.name}</button>)}</div></section>
        <div className="space-y-5 rounded-2xl border border-white/15 bg-slate-900/70 p-5"><RuleCard variantId={selected.id} previousId={previous} language={language} />
          <div className="flex flex-wrap gap-3">{gate.canLaunch ? <Link data-testid="learn-play" state={{ learningVariant: selected.id }} to={`/game?variant=${selected.id}`} className="min-h-11 rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">{ja ? `${selected.name}をプレイ` : `Play ${selected.name}`}</Link> : <p role="status" className="text-sm text-amber-200">{ja ? 'この種目は現在、ルールの確認のみ利用できます。' : 'This game is currently available for rules study only.'}</p>}
          <Link to="/history" className="rounded-xl border border-white/25 px-5 py-3">{ja ? 'プレイ後に履歴を振り返る' : 'Review your hand history'}</Link></div>
          <p className="text-xs text-slate-400">{ja ? 'ベット額・人数・レイズ上限は開始する卓の設定をご確認ください。' : 'Check your table’s bet sizes, player count and raise cap.'}</p>
        </div>
      </div>
    </div>
  </main>;
}
