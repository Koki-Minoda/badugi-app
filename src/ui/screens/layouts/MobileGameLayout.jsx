import OvalTableScene from './OvalTableScene.jsx';
import React,{useEffect,useLayoutEffect,useState} from 'react';
import {getTablePhaseColors} from '../../game/tablePhaseColors.js';
import MobileTableSeat,{TableCard} from './MobileTableSeat.jsx';
import BetAmountSheet from '../../components/BetAmountSheet.jsx';
import getAvailableActions from '../../utils/getAvailableActions.js';
import VariantRuleReminder from '../../learning/VariantRuleReminder.jsx';
import HandResultOverlay from '../../components/HandResultOverlay.jsx';
import HeroBustOverlay from '../../components/HeroBustOverlay.jsx';
import TournamentResultOverlay from '../../components/TournamentResultOverlay.jsx';
import TournamentEliminatedRail from '../../components/TournamentEliminatedRail.jsx';
import '../../../styles/mobile-table.css';
import '../../../styles/oval-table.css';

export default function MobileGameLayout({headerProps:h,sidePanelProps:s,tableProps:t,controlsProps:c,overlaysProps:o,onDebugScale}){
 const [amountOpen,setAmountOpen]=useState(false);
 const [viewport,setViewport]=useState(()=>({width:window.innerWidth,height:window.innerHeight,left:0,top:0}));
 const ja=h.language==='ja';
 useEffect(()=>{onDebugScale?.(1);},[onDebugScale]);
 useLayoutEffect(()=>{
  const vv=window.visualViewport;
  const update=()=>setViewport({width:vv?.width??innerWidth,height:vv?.height??innerHeight,left:vv?.offsetLeft??0,top:vv?.offsetTop??0});
  const previous=document.documentElement.style.overflow;
  const bodyStyle={overflow:document.body.style.overflow,position:document.body.style.position,width:document.body.style.width,top:document.body.style.top,left:document.body.style.left};
  document.documentElement.style.overflow='hidden';
  Object.assign(document.body.style,{overflow:'hidden',position:'fixed',width:'100%',top:'0px',left:'0px'});
  window.scrollTo({top:0,left:0,behavior:'instant'});
  update();vv?.addEventListener('resize',update);vv?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return ()=>{document.documentElement.style.overflow=previous;Object.assign(document.body.style,bodyStyle);vv?.removeEventListener('resize',update);vv?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[]);
 useEffect(()=>{if(!c.heroCanAct || c.controlsPhase!=='BET' || o.handResultVisible)setAmountOpen(false);},[c.heroCanAct,c.controlsPhase,o.handResultVisible,t.gameVariant]);
 const heroIndex=t.heroSeatIndex??0;
 const seats=t.seatViews.map((seat,index)=>({seat,index})).filter(({seat})=>seat&&!seat.hiddenFromTableLayout);
 const hero=seats.find(({index})=>index===heroIndex);
 const others=seats.filter(({index})=>index!==heroIndex);
 // Seat order is fixed; only the exposed cards differ between poker families.
 const actions=c.heroCanAct?getAvailableActions({currentBet:c.controlsCurrentBet,player:c.heroPlayerForControls,canRaise:!c.actionPanelInfo?.capReached}):[];
 const action=kind=>actions.find(a=>kind==='call'?['call','check','allin'].includes(a.variant):a.variant===kind);
 const call=action('call'),raise=action('raise'),fold=action('fold');
 const variableBet=Boolean(c.betSizingModel?.enabled);
 const next=c.showNextButton&&!o.handResultVisible;
 const draw=c.controlsPhase==='DRAW';
 const phaseTone=getTablePhaseColors(c.controlsPhase??t.tablePhase??t.phase).phaseTone;
 const info=c.actionPanelInfo??{};
 const hint=c.heroCanAct?(draw?(ja?'交換するカードをタップ':'Select cards to exchange'):(info.toCall>0?(ja?`あなたの番 · コール ${info.toCall}`:`Your turn · Call ${info.toCall}`):(ja?'あなたの番 · チェックできます':'Your turn · Check available'))):(ja?(info.currentActorName?`${info.currentActorName} の番`:'次の操作を待っています'):(info.waitingLabel||'Waiting'));
 const street=ja?({Preflop:'プリフロップ',Flop:'フロップ',Turn:'ターン',River:'リバー','3rd Street':'3番街','4th Street':'4番街','5th Street':'5番街','6th Street':'6番街','7th Street':'7番街'}[t.streetLabel]||t.streetLabel):t.streetLabel;
 const phase=draw?(ja?`交換 ${Math.max(1,Number(t.drawRoundValue)||1)}/${t.tableSummaryProps?.maxDraws??3}`:'Draw'):(street || (ja?`ベット ${Number(t.betRoundValue||0)+1}`:'Betting'));
 const invoke=a=>{if(!a)return;const fn={onFold:c.playerFold,onCall:c.playerCall,onCheck:c.playerCheck,onRaise:c.playerRaise}[a.handler];fn?.();};
 const renderSeat=({seat,index},isHero=false)=><MobileTableSeat seat={seat} index={index} hero={isHero} active={t.controllerTurn===index} dealer={t.controllerDealerIdx===index} position={t.positionNameFn(index,t.controllerDealerIdx,t.seatLayouts.length)} variant={t.gameVariant} language={h.language} selection={isHero?t.heroDrawSelection:[]} canDraw={isHero&&t.heroCanDraw} onCardClick={t.handleCardClick}/>;
 return <div className={`mgx-play mgx-play--oval ${viewport.width>viewport.height?'is-landscape':'is-portrait'}`} data-layout-mode={viewport.width>viewport.height?'mobile-landscape':'mobile-portrait'} data-testid="mobile-play-layout" data-phase-tone={phaseTone} style={{width:viewport.width,height:viewport.height,left:viewport.left,top:viewport.top}}>
  <header className="mgx-play-header"><div><span className="mgx-wordmark">MGX</span><h1>{h.gameTitle}</h1></div><div className="mgx-play-tools">{t.isTournament&&<TournamentEliminatedRail entries={t.eliminatedRailEntries} layoutMode="mobile" language={h.language}/>}<VariantRuleReminder variantId={t.gameVariant} language={h.language} mobile/><details><summary aria-label={ja?'対局メニュー':'Table menu'}>{ja?'メニュー':'Menu'}</summary><nav><button onClick={h.onNavigateHistory}>{ja?'履歴':'History'}</button><button onClick={h.onNavigateSettings}>{ja?'設定':'Settings'}</button><button onClick={c.isCashGame?c.onCashOut:h.onNavigateTitle}>{ja?(c.isCashGame?'精算して退出':'大会を中断'):(c.isCashGame?'Cash out':'Pause tournament')}</button></nav></details></div></header>
  <main className="mgx-play-main">
   <OvalTableScene others={others} hero={hero} renderSeat={renderSeat}>
    <div className="mgx-community" data-testid="table-community"><div data-testid="table-total-pot"><span>POT</span><strong>{Number(s.totalPot||0).toLocaleString()}</strong></div><div className="mgx-board-cards">{t.boardCards.map((card,i)=><TableCard key={i} card={card} testId={`board-card-${i}`}/>)}</div><span className="mgx-community-phase" data-testid="table-phase-badge">{phase}</span></div>
   </OvalTableScene>
   <aside className="mgx-play-actions" data-testid="decision-panel">
    <div className="mgx-game-context">
     {t.isTournament?<div className="mgx-tournament-info">{t.tournamentHud}</div>:<><span>{phase}</span><span>{t.tableSummaryProps?.sbValue}/{t.tableSummaryProps?.bbValue}</span></>}
     {t.mixedRotation&&<span data-testid="mixed-rotation-status">MIX {t.mixedRotation.handsPlayedInCurrentGame+1}/{t.mixedRotation.handsPerGame}{t.mixedRotation.nextName ? ` · ${ja?'次':'Next'} ${t.mixedRotation.nextName}` : ''}</span>}
    </div>
    <p className={`mgx-turn-message ${c.heroCanAct?'is-your-turn':''}`} role="status" aria-live="polite" data-testid="player-action-hint">{hint}</p>
    <div className="mgx-action-space">
     <div className="mgx-action-setting" data-testid="action-setting-slot">
      {!draw&&!next&&variableBet?<button className="mgx-amount-launch" data-testid="bet-size-input" disabled={!raise} onClick={()=>setAmountOpen(true)}><span>{ja?'ベット金額を指定':'Choose bet amount'}</span><strong>{c.betSizingModel.minCommit}–{c.betSizingModel.maxCommit}<span aria-hidden="true"> ›</span></strong></button>:<div className="mgx-amount-launch mgx-setting-value">
       <span>{next?(ja?'ハンド終了':'Hand finished'):draw?(ja?'カード交換':'Draw cards'):(ja?'固定ベット':'Fixed limit')}</span>
       <strong>{next?(ja?'次のハンドへ':'Next hand'):draw?(ja?`${t.heroDrawSelection.length}枚を選択`:`${t.heroDrawSelection.length} selected`):(ja?`${info.raiseUnit??0} チップ`:`${info.raiseUnit??0} chips`)}</strong>
      </div>}
     </div>
     <div className="mgx-bet-actions" data-testid="action-buttons-slot">
      <button data-testid="action-fold" disabled={draw||next||!fold} onClick={()=>invoke(fold)}>{ja?'フォールド':'Fold'}</button>
      {next?<button className="mgx-primary" data-testid="action-next-hand" onClick={c.onNextHand}>{c.nextHandLabel}</button>:draw?<button className="mgx-primary" data-testid="action-draw-selected" disabled={!c.heroCanAct||!c.heroCanDraw} onClick={c.drawSelected}>{t.heroDrawSelection.length?(ja?`${t.heroDrawSelection.length}枚交換`:`Draw ${t.heroDrawSelection.length}`):(ja?'交換しない':'Stand pat')}</button>:<button className="mgx-primary" data-testid={call?.variant==='check'||!call&&!(info.toCall>0)?'action-check':'action-call'} disabled={!call} onClick={()=>invoke(call)}>{call?.variant==='check'||!call&&!(info.toCall>0)?(ja?'チェック':'Check'):call?.variant==='allin'?(ja?'オールイン':'All in'):(ja?`コール ${info.toCall??0}`:`Call ${info.toCall??0}`)}</button>}
      <button className="mgx-raise" data-testid="action-raise" disabled={draw||next||!raise} onClick={()=>variableBet?setAmountOpen(true):invoke(raise)}>{ja?(info.toCall>0?'レイズ':'ベット'):(info.toCall>0?'Raise':'Bet')}</button>
     </div>
    </div>
    <p className="mgx-action-note">{draw?(ja?'0枚なら交換しません（パット）':'Select zero cards to stand pat'):(ja?'持ち点とポットはチップ単位です':'Stacks and pot are shown in chips')}</p>
   </aside>
  </main>
  {amountOpen&&c.heroCanAct&&<BetAmountSheet key={`${t.gameVariant}:${c.controlsCurrentBet}`} model={c.betSizingModel} language={h.language} onClose={()=>setAmountOpen(false)} onConfirm={amount=>{setAmountOpen(false);c.playerRaise(amount);}}/>}
  <HandResultOverlay players={s.seatViews} heroSeat={s.heroIndex} language={h.language} reviewHandId={o.reviewHandId} visible={o.handResultVisible} summary={o.handResultSummary} onNext={o.onNextHand} buttonLabel={o.nextHandLabel} onReplayTarget={o.onReplayTarget} onHistory={h.onNavigateHistory} onCashOut={c.isCashGame?c.onCashOut:null}/>
  <HeroBustOverlay visible={o.heroBustOverlayVisible} language={h.language} title={o.heroBustSummary?.title} heroSummary={o.heroBustSummary?.hero} inMoneyPlacements={o.heroBustSummary?.inMoney??[]} tournamentReview={o.tournamentReview} onOpenReviewReplay={o.onOpenTournamentReviewReplay} onBackToMenu={o.onTournamentBackToMenu}/>
  <TournamentResultOverlay visible={o.tournamentOverlayVisible} language={h.language} placements={o.tournamentPlacements} title={o.tournamentTitle} tournamentReview={o.tournamentReview} onOpenReviewReplay={o.onOpenTournamentReviewReplay} onBackToMenu={o.onTournamentBackToMenu} onEnterNewTournament={o.onEnterNewTournament}/>
 </div>;
}
