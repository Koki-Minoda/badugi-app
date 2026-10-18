import React, {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

/** Explicit numeric entry avoids shrinking an already short table behind the iOS keyboard. */
export default function BetAmountSheet({model,onConfirm,onClose,language='ja'}) {
  const ja=language==='ja';
  const [digits,setDigits]=useState(String(model.minCommit));
  const [replace,setReplace]=useState(true);
  const dialog=useRef(null);
  const number=Number(digits);
  const valid=digits!=='' && Number.isSafeInteger(number) && number>=model.minCommit && number<=model.maxCommit;
  const choose=amount=>{setDigits(String(amount));setReplace(true);};
  const enter=key=>{
    if(key==='clear'){setDigits('');setReplace(false);return;}
    if(key==='back'){setDigits(value=>value.slice(0,-1));setReplace(false);return;}
    setDigits(value=>(replace?key:(value==='0'?key:value+key)).slice(0,12));setReplace(false);
  };
  useEffect(()=>{
    const previous=document.activeElement;
    previous?.blur?.();dialog.current?.focus();
    return ()=>previous?.isConnected && previous.focus?.({preventScroll:true});
  },[]);
  const keyDown=e=>{
    if(e.key==='Escape'){e.preventDefault();onClose();}
    else if(/^\d$/.test(e.key)){e.preventDefault();enter(e.key);}
    else if(e.key==='Backspace'){e.preventDefault();enter('back');}
    else if(e.key==='Enter' && e.target===dialog.current){e.preventDefault();if(valid)onConfirm(number);}
    else if(e.key==='Tab'){
      const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')];
      const first=buttons[0],last=buttons.at(-1);
      if(e.shiftKey && (document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  return createPortal(<div className="mgx-amount-backdrop">
    <section className="mgx-amount-sheet" data-testid="bet-amount-sheet" role="dialog" aria-modal="true" aria-labelledby="bet-amount-title" tabIndex={-1} ref={dialog} onKeyDown={keyDown}>
      <header><h2 id="bet-amount-title">{ja?'金額を指定': 'Choose amount'}</h2><button onClick={onClose} data-testid="bet-amount-cancel">{ja?'キャンセル':'Cancel'}</button></header>
      <div className="mgx-amount-body">
        <div className="mgx-amount-details">
          <div className="mgx-amount-display"><span>{ja?'今回追加するチップ':'Additional chips'}</span><output data-testid="bet-amount-value" aria-live="polite">{digits||'0'}</output><small>{model.minCommit} – {model.maxCommit}</small></div>
          <div className="mgx-amount-presets">{model.presets.map(p=><button key={p.key} data-testid={`bet-preset-${p.key}`} onClick={()=>choose(p.amount)}>{p.label}<strong>{p.amount}</strong></button>)}</div>
          <p className="mgx-amount-error" role="status">{!valid?(ja?`${model.minCommit}〜${model.maxCommit}で指定`:`Choose ${model.minCommit}–${model.maxCommit}`):ja?'数字キーで金額を置き換えます':'Type to replace the amount'}</p>
          <button className="mgx-primary" data-testid="bet-amount-confirm" disabled={!valid} onClick={()=>onConfirm(number)}>{ja?(model.actionType==='bet'?'ベット':'レイズ'):(model.actionType==='bet'?'Bet':'Raise')} {valid?number:''}</button>
        </div>
        <div className="mgx-number-pad">{['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key=><button key={key} data-testid={`bet-key-${key}`} aria-label={key==='back'?(ja?'1文字削除':'Delete digit'):key==='clear'?(ja?'すべて消す':'Clear'):key} onClick={()=>enter(key)}>{key==='back'?'⌫':key==='clear'?'C':key}</button>)}</div>
      </div>
    </section>
  </div>,document.body);
}
