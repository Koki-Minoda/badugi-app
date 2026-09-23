import React, { useLayoutEffect, useState } from 'react';
import FriendTableScene from './FriendTableScene.jsx';
import VariantRuleReminder from '../../learning/VariantRuleReminder.jsx';
import LanguageSelect from '../../preferences/LanguageSelect.jsx';
import ShareLink from '../../sharing/ShareLink.jsx';
export default function FriendLiveTable({state,room,language,selected,onSelect,pending,onAction,onDraw,onReady,onLeave,status,message}) {
  const ja=language==='ja';
  const [viewport,setViewport]=useState(()=>({width:innerWidth,height:innerHeight}));
  useLayoutEffect(()=>{const vv=window.visualViewport;const update=()=>setViewport({width:vv?.width??innerWidth,height:vv?.height??innerHeight,left:vv?.offsetLeft??0,top:vv?.offsetTop??0});update();vv?.addEventListener('resize',update);vv?.addEventListener('scroll',update);window.addEventListener('resize',update);return()=>{vv?.removeEventListener('resize',update);vv?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};},[]);
  const draw=state.phase.startsWith('draw'),done=state.phase==='showdown',mine=state.currentTurnPlayerId===room.ownerId;
  const legal=state.legalActions;
  const names={badugi:'Badugi',ace_to_five_triple_draw:'A-5 Triple Draw',deuce_to_seven_triple_draw:'2-7 Triple Draw'};
  const unit=state.betUnit??state.config?.bigBlind;
  return <div data-testid="friend-match-layout" className={`mgx-play mgx-play--oval mgx-friend-live ${viewport.width>viewport.height?'is-landscape':'is-portrait'}`} style={viewport} data-phase-tone={draw?'draw':'bet'}>
    <header className="mgx-play-header"><div><span className="mgx-wordmark">MGX</span><h1>{names[state.variantId]??'Badugi'}</h1></div><div className="mgx-play-tools"><VariantRuleReminder variantId={state.variantId} language={language} mobile/><details><summary>{ja?'メニュー':'Menu'}</summary><nav><LanguageSelect/><p>{ja?'ルーム':'Room'} <strong data-testid="p2p-room-code">{room.roomId}</strong></p><ShareLink url={`${window.location.origin}/friend-match?room=${room.roomId}`}/><p>{status==='connected'?(ja?'接続中':'Connected'):status==='polling'?(ja?'接続中（定期更新）':'Connected (polling)'):(ja?'再接続しています':'Reconnecting')}</p><button onClick={onLeave}>{ja?'退出する':'Leave table'}</button></nav></details></div></header>
    <main className="mgx-play-main"><FriendTableScene full state={state} viewerId={room.ownerId} selected={selected} onSelect={onSelect} language={language}/><aside className="mgx-play-actions">
      <div className="mgx-game-context"><span>{draw?(ja?'カード交換':'Draw'):(ja?'ベット':'Betting')}</span><span>{ja?'ベット単位':'Bet size'} {unit}</span></div>
      <p className={`mgx-turn-message ${mine?'is-your-turn':''}`} role="status" aria-live="polite">{done?(ja?'ハンド終了':'Hand finished'):mine?(draw?(ja?'交換するカードをタップ':'Select cards to exchange'):(ja?'あなたの番':'Your turn')):(ja?'相手の操作を待っています':'Waiting for another player')}</p>
      {done ? <><p data-testid="p2p-result">{ja?'ショーダウン勝者':'Showdown winner'}: {(state.showdown?.winnerIds??[]).map(id=>state.playerStates.find(p=>p.id===id)?.displayName??id).join(',')} · POT {state.showdown?.pot}</p><button data-testid="p2p-ready" className="mgx-primary-action" disabled={pending} onClick={onReady}>{ja?'次のハンドに準備':'Ready for next hand'}</button></> : draw ? <button data-testid="p2p-draw" className="mgx-primary-action" disabled={pending||!legal.includes('draw')} onClick={onDraw}>{selected.length ? (ja?`${selected.length}枚を交換`:`Draw ${selected.length}`):(ja?'交換なし（パット）':'Stand pat')}</button> : <div className="mgx-bet-actions"><button data-testid="p2p-fold" disabled={pending||!legal.includes('fold')} onClick={()=>onAction('fold')}>{ja?'フォールド':'Fold'}</button>{legal.includes('check')?<button data-testid="p2p-check" className="mgx-primary" disabled={pending} onClick={()=>onAction('check')}>{ja?'チェック':'Check'}</button>:<button data-testid="p2p-call" className="mgx-primary" disabled={pending||!legal.includes('call')} onClick={()=>onAction('call')}>{ja?'コール':'Call'} {state.toCall||''}</button>}{legal.includes('bet')?<button data-testid="p2p-bet" className="mgx-raise" disabled={pending} onClick={()=>onAction('bet',unit)}>{ja?'ベット':'Bet'} {unit}</button>:<button data-testid="p2p-raise" className="mgx-raise" disabled={pending||!legal.includes('raise')} onClick={()=>onAction('raise',state.toCall+unit)}>{ja?'レイズ':'Raise'} {unit}</button>}</div>}
      {message && <p className="mgx-action-note" role="status">{message}</p>}
    </aside></main>
  </div>;
}
