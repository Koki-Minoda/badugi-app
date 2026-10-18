import {it,expect} from 'vitest';
import Controller from '../BadugiGameController.js';
import {buildNextHandState} from '../../flow/handLifecycle.js';
it('clears a previous result and hand identity when a fresh hand is synchronized',()=>{
 const c=new Controller();const players=[{seatIndex:0,stack:500,hand:['AS','2H','3D','4C'],folded:false}];
 c.syncExternalState({handId:'old',players,lastHandResult:{pot:25},phase:'HAND_RESULT'});
 const next=c.syncFromExternalState({snapshot:{handId:'new',players,phase:'BET',lastHandResult:null,nextTurn:0,metadata:{handId:'new'}}});
 expect(c.getUiSnapshot(next)).toMatchObject({handId:'new',phase:'BET',lastHandResult:null});
 expect(c.isHandFinished(next)).toBe(false);
});
it('retains cash bust age and rebuy amount across repeated deals',()=>{
 let roster=[{name:'Hero',stack:500,seatType:'HUMAN'},{name:'Mina',stack:0,seatType:'CPU',seatOut:true,isBusted:true,bustHandIndex:3,initialStack:700,rebuyStack:900},{name:'Ren',stack:500,seatType:'CPU'}];
 for(let i=0;i<10;i++){
  roster=buildNextHandState({prevPlayers:roster,numSeats:3,seatConfig:['HUMAN','CPU','CPU'],startingStack:500,blindStructure:[{sb:0,bb:0}],drawCardsForSeat:()=>['AS','2H','3D','4C']}).players;
  expect(roster[1]).toMatchObject({bustHandIndex:3,initialStack:700,rebuyStack:900,stack:0,seatOut:true,hand:[]});
 }
});
it('completes exactly three draws when round completion is requested outside an action',()=>{
 const c=new Controller();
 let state=c.syncFromExternalState({snapshot:{handId:'rounds',phase:'BET',drawRound:0,dealerIdx:0,currentBet:10,nextTurn:0,players:[0,1].map(seatIndex=>({seatIndex,stack:500,hand:seatIndex===0?['AS','2H','3D','4C']:['KS','QH','JD','10C'],folded:false,betThisRound:0,totalInvested:0,hasActedThisRound:true}))}});
 for(let round=0;round<3;round++){
  state=c.advanceCompletedRound(state,'BET');
  expect(c.getUiSnapshot(state)).toMatchObject({phase:'DRAW',drawRound:round});
  expect(c.advanceCompletedRound(state,'BET')).toBe(state);
  expect(c.advanceCompletedRound(state,'DRAW')).toBe(state);
  state=c.syncFromExternalState({snapshot:{...c.getUiSnapshot(state),players:c.getUiSnapshot(state).players.map(p=>({...p,hasDrawn:true}))}});
  state=c.advanceCompletedRound(state,'DRAW');
  expect(c.getUiSnapshot(state)).toMatchObject({phase:'BET',drawRound:round+1});
  state=c.syncFromExternalState({snapshot:{...c.getUiSnapshot(state),players:c.getUiSnapshot(state).players.map(p=>({...p,hasActedThisRound:true}))}});
 }
 state=c.advanceCompletedRound(state,'BET');expect(c.getUiSnapshot(state).phase).toBe('SHOWDOWN');
 expect(c.advanceCompletedRound(state,'BET')).toBe(state);
});
it('limits a short all-in winner to the main pot and awards the side pot separately',()=>{
 const c=new Controller();const hands=[['AS','2H','3D','4C'],['5S','6H','7D','8C'],['9S','10H','JD','QC']];
 const state=c.syncFromExternalState({snapshot:{handId:'side-pot',phase:'BET',drawRound:3,currentBet:100,players:[50,100,100].map((totalInvested,seatIndex)=>({seatIndex,name:`Seat ${seatIndex}`,hand:hands[seatIndex],totalInvested,betThisRound:0,stack:0,allIn:true,folded:false,hasActedThisRound:true}))}});
 const result=c.getUiSnapshot(c.advanceCompletedRound(state,'BET'));
 expect(result.players.map(p=>p.stack)).toEqual([150,100,0]);
 expect(result.lastHandResult.pot).toBe(250);
});
