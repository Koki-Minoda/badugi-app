import React, { useState } from 'react';
import { useLearningProgress } from './useLearningProgress.js';
import { setReviewCompleted, progressError } from './progressStore.js';
export default function ReviewCompletion({ reviewKey, language }) {
  const ja = language === 'ja';
  const progress = useLearningProgress();
  const complete = Object.hasOwn(progress.data.reviewed, reviewKey);
  const [error, setError] = useState('');
  return <div className="space-y-2">
    <button type="button" aria-pressed={complete} disabled={Boolean(progress.error)} className="min-h-11 rounded-xl border border-emerald-300/40 px-4 py-2 font-semibold text-emerald-200 disabled:opacity-40" onClick={() => {
      try { setReviewCompleted(reviewKey, !complete); setError(''); }
      catch (failure) { setError(failure.message); }
    }}>{complete ? (ja ? '復習済み・未復習に戻す' : 'Reviewed · Mark pending') : (ja ? '復習済みにする' : 'Mark reviewed')}</button>
    {(progress.error || error) && <p role="alert" className="text-sm text-amber-200">{progressError(progress.error || error, ja)}</p>}
  </div>;
}
