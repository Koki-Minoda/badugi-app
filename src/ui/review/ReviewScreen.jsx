import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getLearningGame, readLearningLanguage } from '../learning/learningCatalog.js';
import { reviewVariant } from './reviewStore.js';
import { reviewError } from './reviewCopy.js';
import { useReviews } from './useReviews.js';
import ReviewEditor from './ReviewEditor.jsx';
import SavedHandDetails from './SavedHandDetails.jsx';
import { reviewPot } from './reviewDetails.js';
import ReviewPracticeLink from '../practice/ReviewPracticeLink.jsx';
import ReviewCompletion from '../learning/progress/ReviewCompletion.jsx';
import { useLearningProgress } from '../learning/progress/useLearningProgress.js';

const variantLabel = hand => getLearningGame(reviewVariant(hand))?.name ?? hand.variantName ?? reviewVariant(hand);
function dateLabel(hand, language) {
  const date = new Date(hand.startedAt ?? hand.ts ?? hand.endedAt);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US') : '—';
}
export default function ReviewScreen() {
  const { entries, error } = useReviews();
  const language = readLearningLanguage();
  const ja = language === 'ja';
  const [params, setParams] = useSearchParams();
  const progress = useLearningProgress();
  const status = ['pending', 'done'].includes(params.get('status')) ? params.get('status') : '';
  const [variant, setVariant] = useState('');
  const [tag, setTag] = useState('');
  const [query, setQuery] = useState('');
  const variants = [...new Map(entries.map(entry => [reviewVariant(entry.hand), variantLabel(entry.hand)])).entries()];
  const tags = [...new Set(entries.flatMap(entry => entry.tags))].sort();
  const visible = entries.filter(entry => (!status || progress.error || Object.hasOwn(progress.data.reviewed, entry.key) === (status === 'done')) && (!variant || reviewVariant(entry.hand) === variant) && (!tag || entry.tags.includes(tag)) &&
    [entry.hand.handId, variantLabel(entry.hand), entry.note, ...entry.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{ja ? '復習一覧' : 'Saved hands'}</h1><div className="flex gap-4 text-emerald-200"><Link to="/learn">{ja ? '学習に戻る' : 'Back to learning'}</Link><Link to="/history">{ja ? 'ハンド履歴' : 'Hand history'}</Link></div></header>
      <p className="text-sm text-slate-300">{ja ? 'あとで振り返りたいハンドとメモを、この端末に保存します。最大200件。通常の履歴から消えたハンドも残ります。' : 'Save hands and notes on this device. Up to 200 hands, kept even after they leave regular history.'}</p>
      {error && <p role="alert" className="rounded-xl border border-amber-200/30 p-4 text-amber-200">{reviewError(error, ja)}</p>}
      <div className="grid gap-3 rounded-2xl border border-white/15 bg-slate-900 p-4 sm:grid-cols-2">
        <label className="text-sm">{ja ? '復習状況' : 'Review status'}<select value={status} disabled={Boolean(progress.error)} onChange={event => setParams(event.target.value ? { status: event.target.value } : {})} className="mt-2 block w-full rounded-lg bg-slate-800 p-3"><option value="">{ja ? 'すべて' : 'All'}</option><option value="pending">{ja ? '未復習' : 'Pending'}</option><option value="done">{ja ? '復習済み' : 'Reviewed'}</option></select></label>
        <label className="text-sm">{ja ? '種目' : 'Game'}<select value={variant} onChange={event => setVariant(event.target.value)} className="mt-2 block w-full rounded-lg bg-slate-800 p-3"><option value="">{ja ? 'すべての種目' : 'All games'}</option>{variants.map(([id, name]) => <option key={id} value={id}>{name}</option>)}{variant && !variants.some(([id]) => id === variant) && <option value={variant}>{variant}</option>}</select></label>
        <label className="text-sm">{ja ? 'タグ' : 'Tag'}<select value={tag} onChange={event => setTag(event.target.value)} className="mt-2 block w-full rounded-lg bg-slate-800 p-3"><option value="">{ja ? 'すべてのタグ' : 'All tags'}</option>{tags.map(value => <option key={value}>{value}</option>)}{tag && !tags.includes(tag) && <option>{tag}</option>}</select></label>
        <label className="text-sm">{ja ? 'メモ・ハンドを検索' : 'Search notes and hands'}<input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 block w-full rounded-lg bg-slate-800 p-3" /></label>
      </div>
      <p role="status" className="text-sm text-emerald-200">{visible.length} / {entries.length}{ja ? '件' : ' saved hands'}</p>
      {!visible.length && <div className="space-y-3 rounded-2xl border border-white/15 p-6"><p>{!entries.length ? (ja ? '復習したいハンドを、対局結果や履歴の「あとで復習に保存」から追加してください。' : 'Use Save for review in hand results or history to add your first hand.') : (ja ? '条件に合うハンドはありません。' : 'No saved hands match these filters.')}</p>{entries.length > 0 && <button type="button" onClick={() => { setVariant(''); setTag(''); setQuery(''); setParams({}); }} className="min-h-11 text-emerald-200 underline">{ja ? '絞り込みを解除' : 'Clear filters'}</button>}</div>}
      {visible.map(entry => <details key={entry.key} data-testid="saved-hand" className="rounded-2xl border border-white/15 bg-slate-900 p-4 sm:p-5">
        <summary className="cursor-pointer space-y-2 break-words"><span className="font-bold text-emerald-200">{variantLabel(entry.hand)}</span>{entry.hand.mode === "practice" && <span className="ml-2 rounded bg-amber-200/10 px-2 py-1 text-xs text-amber-200">{ja ? "配牌練習" : "Practice"}</span>}<span className="ml-3 text-sm text-slate-300">{dateLabel(entry.hand, language)}</span><span className="block text-sm">{entry.hand.handId} · Pot {reviewPot(entry.hand)}</span><span className="flex flex-wrap gap-2">{entry.tags.map(value => <span key={value} className="rounded-full bg-slate-800 px-3 py-1 text-xs">{value}</span>)}</span>{entry.note && <span className="block whitespace-pre-wrap text-sm text-slate-300 line-clamp-2">{entry.note}</span>}</summary>
        <div className="mt-5 space-y-5"><ReviewCompletion reviewKey={entry.key} language={language} /><ReviewPracticeLink hand={entry.hand} language={language} /><SavedHandDetails hand={entry.hand} language={language} /><ReviewEditor entry={entry} language={language} /></div>
      </details>)}
    </div>
  </main>;
}
