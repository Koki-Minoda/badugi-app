import React, { useId, useState } from 'react';
import { MAX_NOTE_LENGTH, parseReviewTags, removeReview, saveReview } from './reviewStore.js';
import { reviewError } from './reviewCopy.js';

export default function ReviewEditor({ entry, language }) {
  const ja = language === 'ja';
  const id = useId();
  const [note, setNote] = useState(entry.note);
  const [tags, setTags] = useState(entry.tags.join(', '));
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  function save(event) {
    event.preventDefault();
    try {
      const saved = saveReview(entry.hand, { note, tags: parseReviewTags(tags) });
      setTags(saved.tags.join(', '));
      setError(null);
      setMessage(ja ? 'メモとタグを保存しました。' : 'Notes and tags saved.');
    } catch (failure) { setMessage(''); setError(failure); }
  }
  return <form onSubmit={save} className="space-y-3 rounded-xl border border-white/15 bg-slate-950/50 p-4">
    <label htmlFor={`${id}-note`} className="block text-sm">{ja ? 'メモ' : 'Notes'}
      <textarea id={`${id}-note`} value={note} maxLength={MAX_NOTE_LENGTH} rows={4} onChange={event => { setNote(event.target.value); setMessage(''); }} className="mt-2 block w-full rounded-lg bg-slate-800 p-3" />
    </label>
    <p className="text-xs text-slate-400">{note.length} / {MAX_NOTE_LENGTH}</p>
    <label htmlFor={`${id}-tags`} className="block text-sm">{ja ? 'タグ（カンマ区切り）' : 'Tags (comma separated)'}
      <input id={`${id}-tags`} value={tags} onChange={event => { setTags(event.target.value); setMessage(''); }} className="mt-2 block w-full rounded-lg bg-slate-800 p-3" />
    </label>
    <p className="text-xs text-slate-400">{ja ? '8個まで、各24文字以内。例：ドロー判断, リバー' : 'Up to eight tags, 24 characters each. Example: Draw decisions, River'}</p>
    <div className="flex flex-wrap gap-3">
      <button type="submit" className="min-h-11 rounded-lg bg-emerald-300 px-4 font-bold text-slate-950">{ja ? 'メモとタグを保存' : 'Save notes and tags'}</button>
      <button type="button" onClick={() => setConfirmRemove(true)} className="min-h-11 rounded-lg border border-white/25 px-4">{ja ? '復習から解除' : 'Remove from saved hands'}</button>
    </div>
    {confirmRemove && <div className="space-y-3 rounded-lg border border-amber-300/40 p-3">
      <p className="text-sm">{ja ? 'この復習のメモとタグも削除します。通常のハンド履歴は残ります。' : 'This also removes its notes and tags. Your regular hand history stays intact.'}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="min-h-11 rounded-lg bg-amber-200 px-3 text-slate-950" onClick={() => { try { removeReview(entry.key); } catch (failure) { setError(failure); } }}>{ja ? '解除する' : 'Confirm removal'}</button>
        <button type="button" className="min-h-11 px-3" onClick={() => setConfirmRemove(false)}>{ja ? 'キャンセル' : 'Cancel'}</button>
      </div>
    </div>}
    {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{reviewError(error, ja)}</p>}
  </form>;
}
