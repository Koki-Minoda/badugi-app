import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RuleCard from './RuleCard.jsx';
import { getLearningGame } from './learningCatalog.js';

export default function VariantRuleReminder({ variantId, language = 'ja', mobile = false }) {
  const game = getLearningGame(variantId);
  const id = game?.id ?? variantId;
  const [seen, setSeen] = useState({ id, previous: null, changed: false });
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  if (seen.id !== id) {
    setSeen({ id, previous: seen.id, changed: true });
    setOpen(false);
  }
  if (!game) return null;
  const ja = language === 'ja';
  return <>
    <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={panelId} data-testid="game-rule-reminder"
      onClick={() => { setOpen(!open); setSeen({ ...seen, changed: false }); }}
      className={`${mobile ? 'shrink-0 min-h-11 rounded-xl bg-slate-950/95 px-3 py-2 text-xs border border-emerald-300/60' : 'hover:text-yellow-400'} text-emerald-200`}>
      {seen.changed ? (ja ? '種目切替 · ' : 'Game changed · ') : ''}{ja ? 'ルール' : 'Rules'}
    </button>
    {open && createPortal(<aside role="dialog" id={panelId} aria-label={ja ? '対局ルール' : 'Table rules'}
      className="fixed right-3 top-14 z-[300] max-h-[72dvh] w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-emerald-300/40 bg-slate-950 p-4 text-white shadow-2xl"
      onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <button ref={closeRef} type="button" onClick={close} className="sticky top-0 z-10 bg-slate-950 mb-3 min-h-11 rounded-lg border border-white/30 px-4">{ja ? '閉じる' : 'Close'}</button>
      <p className="mb-3 text-xs text-slate-400">{ja ? '対局は進行中です。必要な操作は対局画面で行ってください。' : 'Play continues. Make your actions at the table.'}</p>
      <RuleCard variantId={id} previousId={seen.previous} language={language} />
    </aside>, document.body)}
  </>;
}
