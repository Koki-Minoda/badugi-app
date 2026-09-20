import { expect,it } from 'vitest';
import { DeuceToSevenSingleDrawEngine } from '../DeuceToSevenSingleDrawEngine.js';
import { DeuceToSevenSingleDrawController } from '../DeuceToSevenSingleDrawController.js';
const setup=()=>{ const engine=new DeuceToSevenSingleDrawEngine(); return {engine,state:engine.applyForcedBets(engine.initHand({seatConfig:['HUMAN','CPU','CPU'],startingStack:1000,dealerIndex:0,structure:{sb:10,bb:20}}))}; };
it('accepts variable commitments and enforces the next full raise size',()=>{
 const {engine,state}=setup();
 const next=engine.applyBettingAction(state,{seatIndex:0,type:'RAISE',amount:100});
 expect(next.metadata.currentBet).toBe(100); expect(next.metadata.lastFullRaiseSize).toBe(80);
 expect(()=>engine.applyBettingAction(next,{seatIndex:1,type:'RAISE',amount:100})).toThrow(/minimum/);
 const after=engine.applyBettingAction(next,{seatIndex:1,type:'RAISE',amount:170});
 expect(after.metadata.currentBet).toBe(180);
});
it('short all-in raises the call amount but does not reopen raising',()=>{
 const {engine,state}=setup();
 let next=engine.applyBettingAction(state,{seatIndex:0,type:'RAISE',amount:100});
 next.players[1].stack=120;
 next=engine.applyBettingAction(next,{seatIndex:1,type:'RAISE',amount:120});
 expect(next.metadata.currentBet).toBe(130); expect(next.metadata.lastFullRaiseSize).toBe(80);
 next=engine.applyBettingAction(next,{seatIndex:2,type:'CALL'});
 const controller=new DeuceToSevenSingleDrawController({engine});
 expect(controller.getLegalActions({engineState:next},0).map(a=>a.type)).toEqual(['FOLD','CALL']);
 expect(()=>engine.applyBettingAction(next,{seatIndex:0,type:'RAISE',amount:200})).toThrow(/reopen/);
});
it('has no fixed-limit four-raise cap and refunds unmatched all-in contribution through side pots',()=>{
 const {engine,state}=setup(); state.metadata.raiseCountThisRound=9;
 expect(()=>engine.applyBettingAction(state,{seatIndex:0,type:'RAISE',amount:100})).not.toThrow();
 for(const [i,n] of [100,200,300].entries()) {state.players[i].totalInvested=n;state.players[i].bet=0;state.players[i].stack=1000-n;}
 state.players[0].hand=['7S','5D','4C','3H','2S'];state.players[1].hand=['8S','5H','4D','3C','2D'];state.players[2].hand=['9S','6H','4H','3D','2C'];state.pots=[{amount:600,eligiblePlayerIds:state.players.map(p=>p.playerId)}];
 const result=engine.resolveShowdown(state);
 expect(result.state.players.map(p=>p.stack)).toEqual([1200,1000,800]);
 expect(result.state.players.reduce((sum,p)=>sum+p.stack,0)).toBe(3000);
});
