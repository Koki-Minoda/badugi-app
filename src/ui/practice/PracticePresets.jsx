import React, { useEffect, useState } from 'react';
import { PRACTICE_GAMES, validatePracticeSetup } from './practiceSetup.js';
import { MAX_PRESET_NAME, PRESET_CHANGE_EVENT, PRESET_STORAGE_KEY, readPracticePresets, savePracticePreset, removePracticePreset } from './practicePresetStore.js';

const messages = {
  unreadable: ['保存した練習条件を読み込めません。既存のデータは変更していません。', 'Saved practice setups could not be read. Existing data has not been changed.'],
  storage: ['この端末に保存できませんでした。入力を残しています。', 'Could not save on this device. Your input has been kept.'],
  name: ['名前は1〜60文字で入力してください。', 'Enter a name between 1 and 60 characters.'],
  setup: ['種目に合った枚数の手札を選んでください。', 'Choose a complete hand for this game.'],
  duplicate: ['同じ名前の練習条件があります。別の名前を付けてください。', 'That name is already in use. Choose a different name.'],
  limit: ['保存できる練習条件は50件までです。不要な条件を削除してください。', 'You can save up to 50 setups. Remove an unused setup first.'],
};
const buttonClass = 'min-h-11 rounded-xl border border-white/25 px-4 py-2 font-semibold disabled:opacity-40';
export default function PracticePresets({ variant, cards, language, onLoad }) {
  const ja = language === 'ja';
  const [state, setState] = useState(readPracticePresets);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const refresh = event => {
      if (event.type === 'storage' && event.key !== null && event.key !== PRESET_STORAGE_KEY) return;
      setState(readPracticePresets()); setConfirmRemove(false); setNotice('');
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(PRESET_CHANGE_EVENT, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(PRESET_CHANGE_EVENT, refresh); };
  }, []);
  const entry = state.entries.find(item => item.id === selected);
  function save() {
    try {
      const saved = savePracticePreset(name, { variant, cards });
      setSelected(saved.id); setName(''); setError(''); setNotice(ja ? '練習条件を保存しました。' : 'Practice setup saved.');
    } catch (failure) { setError(failure.message); setNotice(''); }
  }
  function load() {
    const fresh = readPracticePresets();
    setState(fresh);
    const item = fresh.entries.find(preset => preset.id === selected);
    if (fresh.error) { setError(fresh.error); setNotice(''); return; }
    if (!item) { setSelected(''); setNotice(''); return; }
    onLoad({ variant: item.variant, cards: [...item.cards] });
    setError(''); setConfirmRemove(false); setNotice(ja ? '練習条件を呼び出しました。手札を確認して開始してください。' : 'Setup loaded. Check your cards, then start practice.');
  }
  function remove() {
    try { removePracticePreset(selected); setSelected(''); setConfirmRemove(false); setError(''); setNotice(ja ? '練習条件を削除しました。' : 'Practice setup removed.'); }
    catch (failure) { setError(failure.message); setNotice(''); }
  }
  return <section className="space-y-3 border-t border-white/15 pt-5" aria-label={ja ? '練習条件の保存と呼び出し' : 'Save and load practice setups'}>
    <h3 className="font-bold">{ja ? '練習条件の保存・呼び出し' : 'Save and load practice setups'}</h3>
    <p className="text-sm text-slate-300">{ja ? '現在選んだ種目と開始手札を、この端末に最大50件保存できます。名前は60文字まで。' : 'Save up to 50 game and starting-hand setups on this device. Names can be up to 60 characters.'}</p>
    <label className="block text-sm">{ja ? '練習条件の名前' : 'Setup name'}<input value={name} maxLength={MAX_PRESET_NAME} onChange={event => { setName(event.target.value); setNotice(''); setError(''); }} className="mt-2 block w-full text-base rounded-xl bg-slate-800 p-3" /></label>
    <button type="button" className={buttonClass} disabled={Boolean(state.error) || !name.trim() || !validatePracticeSetup(variant, cards)} onClick={save}>{ja ? '現在の条件を保存' : 'Save current setup'}</button>
    {state.entries.length > 0 ? <div className="space-y-3">
      <label className="block text-sm">{ja ? '保存した練習条件' : 'Saved practice setups'}<select value={entry ? selected : ''} onChange={event => { setSelected(event.target.value); setConfirmRemove(false); setError(''); setNotice(''); }} className="mt-2 block w-full text-base min-w-0 rounded-xl bg-slate-800 p-3"><option value="">{ja ? '条件を選ぶ' : 'Choose a setup'}</option>{state.entries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {entry && <p className="break-words text-sm text-slate-300" data-testid="preset-preview">{PRACTICE_GAMES.find(game => game.id === entry.variant).name} · {entry.cards.map(card => card.replace(/S$/, '♠').replace(/H$/, '♥').replace(/D$/, '♦').replace(/C$/, '♣')).join(' · ')}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={!entry} onClick={load}>{ja ? 'この条件を呼び出す' : 'Load this setup'}</button><button type="button" className={buttonClass} disabled={!entry} onClick={() => setConfirmRemove(true)}>{ja ? '保存した条件を削除' : 'Remove saved setup'}</button></div>
      {confirmRemove && entry && <div className="space-y-2 rounded-xl bg-slate-800 p-3"><p className="break-words text-sm">{ja ? `「${entry.name}」を削除します。復習ハンドや現在の手札は残ります。` : `Remove “${entry.name}”? Saved hands and your current cards will be kept.`}</p><div className="flex gap-3"><button type="button" className={buttonClass} onClick={remove}>{ja ? '削除する' : 'Confirm removal'}</button><button type="button" className={buttonClass} onClick={() => setConfirmRemove(false)}>{ja ? 'キャンセル' : 'Cancel'}</button></div></div>}
    </div> : !state.error && <p className="text-sm text-slate-400">{ja ? '保存した練習条件はまだありません。' : 'No practice setups saved yet.'}</p>}
    {(state.error || error) && <p role="alert" className="text-sm text-amber-200">{(messages[state.error || error] ?? messages.storage)[ja ? 0 : 1]}</p>}
    {notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}
  </section>;
}
