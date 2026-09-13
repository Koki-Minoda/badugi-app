import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readLearningLanguage } from '../learning/learningCatalog.js';
import ReviewBookmarkButton from '../review/ReviewBookmarkButton.jsx';
import { PRACTICE_GAMES, PRACTICE_CARDS, PracticeSession, validatePracticeSetup } from './practiceSession.js';
import { parsePracticeUrl } from './practiceTransfer.js';
import PracticePresets from './PracticePresets.jsx';
import { recordPracticeCompletion, progressError } from '../learning/progress/progressStore.js';

const cardLabel = card => card.replace(/S$/, '♠').replace(/H$/, '♥').replace(/D$/, '♦').replace(/C$/, '♣');
const actionLabels = { FOLD: ['フォールド', 'Fold'], CHECK: ['チェック', 'Check'], CALL: ['コール', 'Call'], RAISE: ['レイズ', 'Raise'], BET: ['ベット', 'Bet'] };
const buttonClass = 'min-h-11 rounded-xl border border-white/25 px-4 py-2 font-semibold';

export default function PracticeScreen() {
  const location = useLocation();
  return <PracticeContent key={location.key} incoming={parsePracticeUrl(location.search)} />;
}
function PracticeContent({ incoming }) {
  const language = readLearningLanguage();
  const ja = language === 'ja';
  const [variant, setVariant] = useState(incoming?.variant ?? PRACTICE_GAMES[0].id);
  const [cards, setCards] = useState(incoming?.cards ?? (incoming?.error ? [] : [...PRACTICE_GAMES[0].defaults]));
  const [session, setSession] = useState(null);
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState([]);
  const [progressSaveError, setProgressSaveError] = useState('');
  const [error, setError] = useState(incoming?.error ? (ja ? '練習条件を読み込めませんでした。種目と開始手札を選び直してください。' : 'Could not load this setup. Choose the game and starting cards again.') : '');
  const game = PRACTICE_GAMES.find(item => item.id === variant);
  const snapshot = session?.snapshot;
  const finished = session?.finished ?? false;
  const actor = session?.actor;
  const revision = session?.revision;
  const heroTurn = session && !finished && actor === 0;
  const drawPhase = snapshot?.phase === 'DRAW';
  const legal = heroTurn ? session.legalActions(0) : [];
  const hero = snapshot?.players?.[0];
  const toCall = Math.min(hero?.stack ?? 0, Math.max(0, (snapshot?.currentBet ?? 0) - (hero?.betThisRound ?? hero?.bet ?? 0)));
  const betSize = (snapshot?.drawRound ?? 0) >= 2 ? 40 : 20;
  useEffect(() => {
    if (!session || !finished) return;
    try { recordPracticeCompletion(session.record()); setProgressSaveError(''); }
    catch (failure) { setProgressSaveError(failure.message); }
  }, [session, finished]);
  function start() {
    try {
      setSession(new PracticeSession(variant, cards));
      setSelection([]);
      setError('');
      setProgressSaveError('');
    } catch { setError(ja ? '練習を開始できませんでした。手札を選び直してください。' : 'Could not start practice. Please choose your hand again.'); }
  }
  function act(action) {
    try {
      if (session.act(0, action, revision)) { setSelection([]); setVersion(value => value + 1); }
    } catch { setError(ja ? '操作を続けられませんでした。条件を変更して練習をやり直してください。' : 'The hand could not continue. Change the setup to restart practice.'); }
  }
  useEffect(() => {
    if (!session || finished || actor === 0 || error) return;
    const timer = setTimeout(() => {
      try { session.cpuAction(); setVersion(value => value + 1); }
      catch { setError(ja ? 'CPUの操作を続けられませんでした。条件を変更してやり直してください。' : 'The CPU could not continue. Change the setup to restart.'); }
    }, 150);
    return () => clearTimeout(timer);
  }, [session, version, finished, actor, error, ja]);

  return <main className="learning-screen min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ja ? '開始手札を決めて練習' : 'Practice a starting hand'}</h1>
        <Link to="/learn" className="min-h-11 py-2 text-emerald-200">{ja ? '学習に戻る' : 'Back to learning'}</Link>
      </header>
      <p className="rounded-xl border border-amber-200/30 bg-amber-200/5 p-3 text-sm text-amber-100" data-testid="practice-mode-notice">{ja ? '練習専用 · レート・通常の対局成績には反映されません。' : 'Practice only · Does not affect ratings or regular game statistics.'}</p>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {!session ? <section className="space-y-5 rounded-2xl border border-white/15 bg-slate-900 p-4 sm:p-6">
        {incoming && !incoming.error && <p className="text-sm text-emerald-200">{ja ? '開始手札を読み込みました。条件を確認して練習を開始してください。' : 'Starting hand loaded. Check the setup before starting practice.'}</p>}
        <label className="block">{ja ? '種目' : 'Game'}<select aria-label={ja ? '種目' : 'Game'} value={variant} onChange={event => { const next = PRACTICE_GAMES.find(item => item.id === event.target.value); setVariant(next.id); setCards([...next.defaults]); setError(''); }} className="mt-2 block w-full rounded-xl bg-slate-800 p-3">{PRACTICE_GAMES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{ja ? '自分の開始手札' : 'Your starting hand'} · {cards.length} / {game.count}</h2><button type="button" className={buttonClass} onClick={() => setCards([])}>{ja ? '選択をクリア' : 'Clear selection'}</button></div>
        <div className="flex min-h-12 flex-wrap gap-2" aria-label={ja ? '選んだ手札' : 'Selected hand'}>{cards.map(card => <span key={card} className={`rounded-lg bg-white px-3 py-3 font-bold ${/[HD]$/.test(card) ? 'text-red-700' : 'text-slate-950'}`}>{cardLabel(card)}</span>)}</div>
        <p className="text-sm text-slate-300">{ja ? `${game.count}枚選んでください。選択中のカードを押すと解除できます。` : `Choose ${game.count} cards. Press a selected card to remove it.`}</p>
        <div className="space-y-3">{['S', 'H', 'D', 'C'].map(suit => <div key={suit} className="grid grid-cols-7 gap-2 sm:grid-cols-[repeat(13,minmax(0,1fr))]">{PRACTICE_CARDS.filter(card => card.endsWith(suit)).map(card => <button type="button" key={card} aria-pressed={cards.includes(card)} disabled={!cards.includes(card) && cards.length === game.count} onClick={() => setCards(previous => previous.includes(card) ? previous.filter(value => value !== card) : [...previous, card])} className={`min-h-11 min-w-0 rounded-lg border px-1 text-sm font-bold disabled:opacity-40 ${cards.includes(card) ? 'border-emerald-300 bg-emerald-300 text-slate-950' : /[HD]$/.test(card) ? 'border-white/20 bg-slate-800 text-red-300' : 'border-white/20 bg-slate-800 text-white'}`}>{cardLabel(card)}</button>)}</div>)}</div>
        <p className="text-sm leading-relaxed text-slate-300">{ja ? '6人卓、自分はボタン、持ち点は全員2,000、ブラインド10/20。相手5人はCPUです。自分の開始手札を固定し、相手の手札と山札は毎回配り直します。' : 'Six seats, you on the button, 2,000 chips each, blinds 10/20. Five CPU opponents. Your starting hand stays fixed; opponents and the remaining deck are dealt again each time.'}</p>
        <button type="button" onClick={start} disabled={!validatePracticeSetup(variant, cards)} className="min-h-12 w-full rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-40">{ja ? 'この手札で練習する' : 'Practice this hand'}</button>
        <PracticePresets variant={variant} cards={cards} language={language} onLoad={setup => { setVariant(setup.variant); setCards(setup.cards); setError(''); }} />
      </section> : <section className="space-y-5" data-testid="practice-table">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{game.name}</h2><button type="button" className={buttonClass} onClick={() => { setSession(null); setError(''); setSelection([]); }}>{ja ? '条件を変更' : 'Change setup'}</button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{snapshot.players.slice(1).map((player, index) => <div key={index} data-testid={`practice-cpu-${index + 1}`} className={`min-w-0 space-y-2 rounded-xl border p-3 ${actor === index + 1 && !finished ? 'border-amber-200' : 'border-white/15'} ${player.folded ? 'opacity-50' : ''}`}><p className="truncate text-sm font-semibold">CPU {index + 1}</p><p className="text-sm">{player.stack} <span className="text-slate-400">· {ja ? 'ベット' : 'Bet'} {player.betThisRound ?? player.bet ?? 0}</span></p><p className="flex flex-wrap gap-1 text-sm">{player.hand.map((card, cardIndex) => <span key={cardIndex} className="rounded bg-slate-800 px-1">{finished && !player.folded ? cardLabel(card) : '▧'}</span>)}</p><p className="text-xs text-slate-300">{player.folded ? (ja ? 'フォールド' : 'Folded') : player.lastAction}</p></div>)}</div>
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-900/20 p-4 text-center">
          <p className="text-lg font-bold">Pot {finished ? snapshot.lastHandResult?.pot ?? 0 : snapshot.pot ?? snapshot.players.reduce((sum, player) => sum + (player.totalInvested ?? 0), 0)}</p>
          <p role="status" data-testid="practice-turn">{finished ? (ja ? 'ハンド終了' : 'Hand finished') : `${drawPhase ? (ja ? 'カード交換' : 'Draw') : (ja ? 'ベット' : 'Betting')} · ${ja ? '交換' : 'Draw round'} ${snapshot.drawRound ?? 0}/3 · ${heroTurn ? (ja ? 'あなたの番' : 'Your turn') : `CPU ${actor}`}`}</p>
        </div>
        <div className="space-y-4 rounded-2xl border border-white/20 bg-slate-900 p-4">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{ja ? '自分の手札' : 'Your hand'} · BTN</h3><p>{ja ? '持ち点' : 'Stack'} {hero.stack}</p></div>
          <div className="flex flex-wrap justify-center gap-2" data-testid="practice-hero-hand">{hero.hand.map((card, index) => <button type="button" key={`${index}-${card}`} aria-label={cardLabel(card)} aria-pressed={selection.includes(index)} disabled={!heroTurn || !drawPhase || Boolean(error)} onClick={() => setSelection(previous => previous.includes(index) ? previous.filter(value => value !== index) : [...previous, index])} className={`min-h-16 min-w-12 rounded-lg border-2 bg-white px-2 py-4 text-lg font-bold ${/[HD]$/.test(card) ? 'text-red-700' : 'text-slate-950'} ${selection.includes(index) ? 'border-amber-400 ring-2 ring-amber-400' : 'border-white'}`}>{cardLabel(card)}</button>)}</div>
          {!finished && <div className="space-y-3">
            {heroTurn && drawPhase && <p className="text-sm text-slate-300">{ja ? '交換したいカードを選んでください。0枚ならそのまま進みます。' : 'Select cards to discard. Select none to stand pat.'}</p>}
            <div className="flex flex-wrap justify-center gap-2">{legal.map(action => action.type === 'DRAW' ? <button type="button" key="DRAW" disabled={Boolean(error)} className={`${buttonClass} bg-emerald-300 text-slate-950`} onClick={() => act({ type: 'DRAW', discardIndexes: selection })}>{ja ? `${selection.length}枚交換する` : `Draw ${selection.length} cards`}</button> : <button type="button" key={action.type} disabled={Boolean(error)} className={buttonClass} onClick={() => act({ type: action.type })}>{actionLabels[action.type]?.[ja ? 0 : 1] ?? action.type}{action.type === 'CALL' ? ` ${toCall}` : ['RAISE', 'BET'].includes(action.type) ? ` +${betSize}` : ''}</button>)}</div>
          </div>}
          {finished && <div className="space-y-4" data-testid="practice-result">
            {progressSaveError && <div className="text-sm text-amber-200"><p role="alert">{progressError(progressSaveError, ja)}</p><button type="button" className="min-h-11 underline" onClick={() => { try { recordPracticeCompletion(session.record()); setProgressSaveError(''); } catch (failure) { setProgressSaveError(failure.message); } }}>{ja ? '進捗の保存を再試行' : 'Retry saving progress'}</button></div>}
            <p className="text-center text-sm text-emerald-200">{ja ? '勝者' : 'Winner'}: {(snapshot.lastHandResult?.winners ?? []).map(winner => winner.seatIndex === 0 ? (ja ? '自分' : 'You') : `CPU ${winner.seatIndex}`).join(', ')}</p>
            <p className="text-center text-lg font-bold">{ja ? 'このハンドの増減' : 'This hand’s change'}: {hero.stack - 2000 >= 0 ? '+' : ''}{hero.stack - 2000}</p>
            <ReviewBookmarkButton key={session.handId} hand={session.record()} language={language} />
            <button type="button" onClick={start} className="min-h-12 w-full rounded-xl bg-emerald-300 px-4 py-3 font-bold text-slate-950">{ja ? '同じ開始手札でもう一度' : 'Repeat this starting hand'}</button>
            <p className="text-xs text-slate-400">{ja ? '次の練習は全員2,000点から始まります。' : 'Everyone starts the next practice hand with 2,000 chips.'}</p>
            <Link to="/learn/review" className="inline-block min-h-11 py-2 text-emerald-200">{ja ? '復習一覧を開く' : 'Open saved hands'}</Link>
          </div>}
        </div>
      </section>}
    </div>
  </main>;
}
