import React, { useState } from 'react';
import { findHandHistoryById } from '../state/handHistoryStore.js';
import { findPersistedHandHistoryById } from '../utils/persistedHandHistory.js';
import { readLearningLanguage } from '../learning/learningCatalog.js';
import { reviewKey, saveReview } from './reviewStore.js';
import { reviewError } from './reviewCopy.js';
import { useReviews } from './useReviews.js';

export default function ReviewBookmarkButton({ hand, handId, language = readLearningLanguage() }) {
  const { entries } = useReviews();
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState(null);
  const ja = language === 'ja';
  const saved = entries.some(entry => entry.key === (hand ? reviewKey(hand) : savedKey));
  function save() {
    try {
      const snapshot = hand ?? findHandHistoryById(handId) ?? findPersistedHandHistoryById(handId);
      const entry = saveReview(snapshot);
      setSavedKey(entry.key);
      setError(null);
    } catch (failure) { setError(failure); }
  }
  return <div className="space-y-2 text-sm">
    <button type="button" disabled={saved} onClick={save} className="min-h-11 rounded-xl border border-emerald-300/40 px-4 py-2 font-semibold text-emerald-200 disabled:opacity-70">
      {saved ? (ja ? '復習に保存済み' : 'Saved for review') : (ja ? 'あとで復習に保存' : 'Save for review')}
    </button>
    {saved && <p role="status" className="text-xs text-slate-300">{ja ? '学習 → 復習一覧でメモを追加できます。' : 'Add notes in Learn → Saved hands.'}</p>}
    {error && <p role="alert" className="text-amber-200">{reviewError(error, ja)}</p>}
  </div>;
}
