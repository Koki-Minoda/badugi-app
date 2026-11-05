import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import '../../styles/current-hand-history.css';

/** Presentation only: showing the line never dispatches a poker action. */
export default function CurrentHandHistory({handId, actions = [], language = 'ja', onHistory}) {
  const ja = language === 'ja';
  const titleId = useId();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const closeButton = useRef(null);
  const [openedHand, setOpenedHand] = useState(null);
  // A new hand closes the old view, including when the component stays mounted.
  const open = openedHand !== null && openedHand.id === handId;
  useEffect(() => {
    const node = dialog.current;
    if (!open) return undefined;
    node.showModal();
    closeButton.current?.focus({preventScroll: true});
    const opener = trigger.current;
    return () => {
      node.close();
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, [open]);
  const close = () => setOpenedHand(null);
  const keepFocus = event => {
    if (event.key !== 'Tab') return;
    const targets = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    // Safari can skip buttons when full keyboard access is disabled. Move each
    // step explicitly so the same reachable order works on both engines.
    const index = targets.indexOf(document.activeElement);
    const next = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
    event.preventDefault(); targets[next]?.focus();
  };
  return <>
    <button type="button" ref={trigger} className="mgx-line-trigger" data-testid="current-hand-history-open"
      aria-haspopup="dialog" onClick={() => setOpenedHand({id: handId})}>
      {ja ? '現ハンド履歴' : 'Hand line'}
    </button>
    {createPortal(<dialog ref={dialog} className="mgx-line-sheet" aria-labelledby={titleId}
      aria-modal="true" data-testid="current-hand-history" onKeyDown={keepFocus} onCancel={event => {event.preventDefault(); close();}}>
      <header><h2 id={titleId}>{ja ? '現ハンドの操作履歴' : 'Current hand line'}</h2>
        <button type="button" ref={closeButton} onClick={close}>{ja ? '閉じる' : 'Close'}</button></header>
      <p className="mgx-line-unit">{ja ? '金額はチップ単位 · 記録順に表示' : 'Amounts in chips · chronological order'}</p>
      <div className="mgx-line-scroll" tabIndex={0} aria-label={ja ? '操作履歴' : 'Action sequence'}>
        {actions.length ? <ol>{actions.map((entry, index) => <li key={index} className={entry.type === 'phase' ? 'is-phase' : ''}>
          <span className="mgx-line-number" aria-hidden="true">{index + 1}</span><span>{entry.label}</span>
        </li>)}</ol> : <p>{ja ? 'このハンドの操作はまだありません。' : 'No actions recorded in this hand yet.'}</p>}
      </div>
      {onHistory && <footer><button type="button" onClick={() => {close(); onHistory();}}>
        {ja ? '保存済みハンドの履歴へ' : 'Saved hand history'}
      </button></footer>}
    </dialog>, document.body)}
  </>;
}
