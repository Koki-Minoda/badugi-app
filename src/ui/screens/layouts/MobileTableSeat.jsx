import React from 'react';
import {getDisplayCards} from '../../utils/cardDisplayOrder.js';

const suits={S:['♠','spade'],H:['♥','heart'],D:['♦','diamond'],C:['♣','club']};
export function TableCard({card,hidden=false,selected=false,onClick,testId,down=false}){
 const value=String(card||'');const [symbol,color]=suits[value.slice(-1).toUpperCase()]||['?','spade'];
 const Tag=onClick?'button':'span';
 return <Tag type={onClick?'button':undefined} className={`mgx-table-card ${hidden?'is-hidden':color} ${selected?'is-selected':''} ${down?'is-down':''}`} onClick={onClick} data-testid={testId} aria-label={hidden?'伏せ札':`${value.slice(0,-1)}${symbol}${down?'・伏せ札':''}`} aria-pressed={onClick?selected:undefined}>
  {hidden?<span aria-hidden="true">◇</span>:<><b>{value.slice(0,-1)}</b><span>{symbol}</span></>}
 </Tag>;
}
export default function MobileTableSeat({seat,index,hero=false,active=false,dealer=false,position,variant,selection=[],canDraw=false,onCardClick,language='ja',cardTestPrefix}){
 const ja=language==='ja';const hand=Array.isArray(seat.hand)&&seat.hand.length?seat.hand:(seat.holeCards||[]);const stud=Array.isArray(seat.cardVisibility)&&seat.cardVisibility.length>0;
 const folded=seat.folded||seat.isBusted||seat.seatOut;
 const cards=getDisplayCards(hand,{displayVariant:variant});
 const action=folded?(ja?'フォールド':'Folded'):seat.allIn?'ALL IN':!stud&&seat.lastDrawCount!=null?(seat.lastDrawCount===0?'PAT':`D${seat.lastDrawCount}`):'';
 return <section data-testid={`seat-${index}`} className={`mgx-table-seat ${hero?'is-hero':''} ${cards.length>5?'is-long-hand':''} ${active?'is-active':''} ${folded?'is-folded':''}`} aria-label={`${hero?(ja?'あなた':'You'):seat.name} ${seat.stack??0}`}>
  <div className="mgx-seat-avatar" aria-hidden="true" style={{'--seat-hue':`${[150,205,32,275,350,175][index%6]}deg`}}><svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="6"/><path d="M4 31v-3a12 12 0 0 1 24 0v3"/></svg></div>
  <div className="mgx-seat-heading"><span className="mgx-seat-name">{hero?(ja?'あなた':'You'):seat.name}</span><span className="mgx-seat-position">{!/^(stud|razz)/i.test(String(variant)) && <>{dealer?'D · ':''}{position}</>}</span><strong data-testid={`seat-${index}-stack`}>{Number(seat.stack??0).toLocaleString()}</strong></div>
  <div className="mgx-seat-cards" data-testid={`player-${index}-card-row`} style={{'--hand-count':Math.max(cards.length,1)}}>
   {cards.map(({card,sourceIndex})=>{
    const up=stud&&seat.cardVisibility[sourceIndex]==='up';
    const hidden=folded || (!hero&&!seat.showHand&&!up);
    return <TableCard key={sourceIndex} card={card} hidden={hidden} down={hero&&stud&&!up} selected={selection.includes(sourceIndex)} onClick={hero&&canDraw&&!folded?()=>onCardClick(sourceIndex):undefined} testId={cardTestPrefix ? `${cardTestPrefix}-${sourceIndex}` : `player-${index}-card-${sourceIndex}`}/>;
   })}
  </div>
  <div className="mgx-seat-meta"><span data-testid={!stud&&seat.lastDrawCount!=null&&!folded?`seat-${index}-draw-badge`:undefined}>{action|| (active?(ja?'考え中':'Acting'):'\u00a0')}</span><span data-testid={`seat-${index}-bet`}>{Number(seat.betThisRound??seat.bet??0)>0?`${ja?'ベット':'Bet'} ${seat.betThisRound??seat.bet}`:'\u00a0'}</span></div>
 </section>;
}
