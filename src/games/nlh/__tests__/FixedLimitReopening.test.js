import {describe,it,expect} from 'vitest';
import {FLHGameController} from '../FLHGameController.js';
import {FLSuperHoldemGameController} from '../SuperHoldemGameController.js';
import {FLO8GameController} from '../../plo/FLO8GameController.js';
import NLHGameController from '../NLHGameController.js';
import PLOGameController from '../../plo/PLOGameController.js';

function setup(Controller, street, fraction) {
  const controller=new Controller({tableConfig:{seats:[0,1,2].map(i=>({name:`Seat ${i}`,stack:1000})),blinds:{sb:10,bb:20,ante:0}}});
  controller.startNewHand();
  const unit=street==='TURN'?40:20;
  Object.assign(controller.state,{street,currentActor:0,currentBet:unit,lastFullRaiseSize:unit,raiseRestrictedSeatIndexes:[],pot:unit*2});
  controller.state.players.forEach((p,i)=>Object.assign(p,{stack:i===0?unit+Math.floor(unit*fraction):1000,betThisStreet:i===0?0:unit,totalInvested:i===0?0:unit,hasActedThisStreet:i===1,allIn:false,folded:false}));
  controller.raiseCountThisStreet=1;
  return {controller,unit};
}
for(const Controller of [FLHGameController,FLSuperHoldemGameController,FLO8GameController]) {
 describe(Controller.name,()=>{
  for(const street of ['FLOP','TURN']) {
   it(`${street}: a half-unit all-in reopens a previous caller's raise`,()=>{
    const {controller:c,unit}=setup(Controller,street,0.5);
    expect(c.applyPlayerAction({seatIndex:0,action:'all-in'}).success).toBe(true);
    expect(c.state.raiseRestrictedSeatIndexes).not.toContain(1);
    expect(c.raiseCountThisStreet).toBe(2);
    const before=c.state.currentBet;
    expect(c.applyPlayerAction({seatIndex:1,action:'raise'}).success).toBe(true);
    expect(c.state.currentBet).toBe(before+unit);
   });
   it(`${street}: less than half does not reopen or consume a full raise`,()=>{
    const {controller:c}=setup(Controller,street,0.49);
    expect(c.applyPlayerAction({seatIndex:0,action:'all-in'}).success).toBe(true);
    expect(c.state.raiseRestrictedSeatIndexes).toContain(1);
    expect(c.raiseCountThisStreet).toBe(1);
    expect(c.applyPlayerAction({seatIndex:1,action:'raise'}).success).toBe(false);
    expect(c.raiseCountThisStreet).toBe(1);
   });
   it(`${street}: a short raise through the raise action has the same cap accounting`,()=>{
    const {controller:c}=setup(Controller,street,0.49);
    expect(c.applyPlayerAction({seatIndex:0,action:'raise'}).success).toBe(true);
    expect(c.raiseCountThisStreet).toBe(1);
    expect(c.state.raiseRestrictedSeatIndexes).toContain(1);
   });
  }
 });
}
for(const Controller of [NLHGameController,PLOGameController]) {
 it(`${Controller.name}: a half raise still does not reopen no-limit/pot-limit`,()=>{
  const {controller:c}=setup(Controller,'FLOP',0.5);
  expect(c.applyPlayerAction({seatIndex:0,action:'all-in'}).success).toBe(true);
  expect(c.state.raiseRestrictedSeatIndexes).toContain(1);
  expect(c.applyPlayerAction({seatIndex:1,action:'raise',amount:100}).success).toBe(false);
 });
}
