import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReviews } from '../../review/useReviews.js';
import { useLearningProgress } from './useLearningProgress.js';
import { progressSummary, progressError } from './progressStore.js';
import { QUIZ_QUESTIONS } from '../quizCatalog.js';
import { readPracticePresets, PRESET_STORAGE_KEY, PRESET_CHANGE_EVENT } from '../../practice/practicePresetStore.js';
import { practiceUrl } from '../../practice/practiceTransfer.js';

export default function LearningDashboard({ language }) {
  const ja = language === 'ja';
  const { data, error } = useLearningProgress();
  const reviews = useReviews();
  const [presets, setPresets] = useState(readPracticePresets);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = event => {
      if (event.type !== 'storage' || event.key === null || event.key === PRESET_STORAGE_KEY) setPresets(readPracticePresets());
      setNow(Date.now());
    };
    const timer = setInterval(() => setNow(Date.now()), 60000);
    window.addEventListener(PRESET_CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { clearInterval(timer); window.removeEventListener(PRESET_CHANGE_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const summary = progressSummary(data, reviews.entries, now);
  const missed = summary.missedIds.filter(id => QUIZ_QUESTIONS.some(question => question.id === id));
  const preset = presets.entries[0];
  const cardClass = 'block min-h-11 rounded-xl border border-white/20 bg-slate-950/50 p-4 text-emerald-200 break-words';
  return <section data-testid="learning-dashboard" className="space-y-4 rounded-2xl border border-emerald-300/30 bg-slate-900 p-5">
    <h2 className="text-xl font-bold">{ja ? '今日やること' : 'What to study today'}</h2>
    <p className="text-sm text-slate-300">{ja ? 'この端末の学習記録。練習は終了したハンド、正解率は復習を含む全回答を数えます。' : 'Progress on this device. Practice counts completed hands; accuracy includes all answers, including retries.'}</p>
    {error ? <p role="alert" className="text-amber-200">{progressError(error, ja)}</p> : <>
      <div className="grid gap-3 sm:grid-cols-3" data-testid="learning-totals">
        <p>{ja ? '練習完了' : 'Practice completed'} <b>{summary.practiceCount}</b>{ja ? 'ハンド' : ' hands'}</p>
        <p>{ja ? 'クイズ正解率' : 'Quiz accuracy'} <b>{summary.accuracy === null ? '—' : `${summary.accuracy}%`}</b> ({summary.correct}/{summary.answerCount})</p>
        <p>{ja ? '復習済み' : 'Reviewed'} <b>{reviews.error ? '—' : `${summary.reviewedCount}/${reviews.entries.length}`}</b></p>
      </div>
      <p className="text-sm text-slate-300" data-testid="learning-today">{ja ? `今日：練習 ${summary.todayPractices}ハンド・回答 ${summary.todayAnswers}問・復習 ${summary.todayReviewed}件` : `Today: ${summary.todayPractices} practice hands · ${summary.todayAnswers} answers · ${summary.todayReviewed} reviewed hands`}</p>
    </>}
    <div className="grid gap-3 md:grid-cols-3">
      {!error && !reviews.error && summary.pendingCount > 0
        ? <Link className={cardClass} to="/learn/review?status=pending">{ja ? `未復習のハンドを振り返る（${summary.pendingCount}件）` : `Review saved hands (${summary.pendingCount} pending)`}</Link>
        : <Link className={cardClass} to="/learn/review">{ja ? '復習一覧を確認する' : 'Open saved hands'}</Link>}
      {!error && missed.length > 0
        ? <Link className={cardClass} to="/learn/quiz?retry=missed">{ja ? `間違えたクイズを復習（${missed.length}問）` : `Retry missed questions (${missed.length})`}</Link>
        : <Link className={cardClass} to="/learn/quiz?topic=draw_rules">{ja ? '種目切り替えのルールを6問' : 'Six game-switching rule questions'}</Link>}
      <Link className={cardClass} to={preset ? practiceUrl(preset) : '/learn/practice'}>{preset ? (ja ? `保存条件「${preset.name}」で1ハンド練習` : `Practice one hand with “${preset.name}”`) : (ja ? '開始手札を選んで1ハンド練習' : 'Choose a starting hand to practice')}</Link>
    </div>
    {(reviews.error || presets.error) && <p className="text-sm text-amber-200">{ja ? '復習または保存条件を読み込めないため、おすすめの一部を表示できません。各一覧で確認してください。' : 'Some suggestions are unavailable because saved hands or setups could not be read. Check their respective lists.'}</p>}
  </section>;
}
