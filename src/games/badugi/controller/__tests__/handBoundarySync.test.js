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
