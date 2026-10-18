import React from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_PLAYABLE_VARIANTS } from '../../games/config/variantAvailability.js';
import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
export default function TrialScreen() {
  const ja = useLanguage() === 'ja';
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-4xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{ja ? '登録せずに1ハンド体験' : 'Try a hand without signing up'}</h1><LanguageSelect /></header><p className="text-slate-300">{ja ? '種目を選んでCPUと対局できます。体験プレイの成績は保存しません。続けて遊びたくなったら登録できます。' : 'Choose a game and play against CPUs. Trial results are not saved. Sign up when you want to keep playing.'}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PUBLIC_PLAYABLE_VARIANTS.map(game => <article key={game.id} className="min-w-0 rounded-xl border border-white/20 bg-slate-900 p-3"><h2 className="font-bold">{game.displayName}</h2><Link className="mt-3 block min-h-11 rounded-lg bg-emerald-300 px-3 py-2 text-center font-bold text-slate-950" to={`/game?trial=1&variant=${game.availabilityKey}`} state={{ learningVariant:game.availabilityKey }}>{ja ? '体験する' : 'Try it'}</Link><Link className="mt-1 block min-h-11 py-2 text-center text-sm text-emerald-200" to={`/learn?variant=${game.availabilityKey}`}>{ja ? 'ルールを見る' : 'Read rules'}</Link></article>)}</div><Link className="inline-block min-h-11 py-2 text-emerald-200" to="/">{ja ? '登録・ログインへ' : 'Sign up / log in'}</Link></div></main>;
}
