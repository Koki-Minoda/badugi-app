import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { hasSaveFailure, subscribeSaveFailures } from '../../storage/criticalSave.js';

export default function SaveFailureNotice({ language = 'ja' }) {
  const failed = useSyncExternalStore(subscribeSaveFailures, hasSaveFailure, () => false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (!failed) setDismissed(false); }, [failed]);
  if (!failed || dismissed) return null;
  const ja = language === 'ja';
  return <div role="alert" data-testid="save-failure-notice" className="fixed left-4 right-4 top-4 z-[100] mx-auto max-w-md rounded-xl border border-amber-400 bg-gray-950 p-4 text-sm text-white shadow-xl">
    <p>{ja ? '進行状況の一部を端末に保存できませんでした。画面を閉じると、直前の保存地点まで戻る可能性があります。端末の保存容量を確認してください。' : 'Some progress could not be saved on this device. Closing this page may lose progress since the last save. Check your device storage.'}</p>
    <button className="mt-2 min-h-11 rounded-lg border border-white/50 px-4" onClick={() => setDismissed(true)}>{ja ? '閉じる' : 'Dismiss'}</button>
  </div>;
}
