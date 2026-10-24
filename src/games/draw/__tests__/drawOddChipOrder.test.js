import { describe, expect, it } from 'vitest';
import { DeuceToSevenTripleDrawEngine } from '../DeuceToSevenTripleDrawEngine.js';
import { AceToFiveTripleDrawEngine } from '../AceToFiveTripleDrawEngine.js';
import { FiveCardSingleDrawEngine } from '../FiveCardSingleDrawEngine.js';
import { BadeuceyTripleDrawEngine, BadaceyTripleDrawEngine, BadeuceySingleDrawEngine, BadaceySingleDrawEngine, BadugiSingleDrawEngine, HidugiTripleDrawEngine, HidugiSingleDrawEngine, ArchieTripleDrawEngine } from '../SpecialDrawEngine.js';

const engines = [DeuceToSevenTripleDrawEngine, AceToFiveTripleDrawEngine, FiveCardSingleDrawEngine, BadeuceyTripleDrawEngine, BadaceyTripleDrawEngine, BadeuceySingleDrawEngine, BadaceySingleDrawEngine, BadugiSingleDrawEngine, HidugiTripleDrawEngine, HidugiSingleDrawEngine, ArchieTripleDrawEngine];
function fixture(Engine, dealerIndex, contributions) {
  const engine = new Engine();
  const state = engine.initHand({seatConfig:['HUMAN','CPU','CPU'],startingStack:0,dealerIndex});
  const hands = engine.handCardCount === 4
    ? [['7S','5D','4C','2H'],['7D','5C','4H','2S'],['KS','QD','JC','TH']]
    : [['7S','5D','4C','3H','2S'],['7D','5C','4H','3S','2D'],['KS','QD','JC','TH','9S']];
  state.players.forEach((player,i)=>Object.assign(player,{hand:hands[i],bet:0,stack:0,totalInvested:contributions[i],folded:i===2}));
  state.pots=[{amount:contributions.reduce((a,b)=>a+b,0),eligiblePlayerIds:state.players.slice(0,2).map(p=>p.playerId)}];
  return {engine,state};
}

describe('button draw odd chips (BARGE ties & odd chips)',()=>{
  for (const Engine of engines) {
    it.each([[0,1],[1,0],[2,0]])(`${Engine.name}: tie follows button %s, skipping folded seats`,(button,recipient)=>{
      const {engine,state}=fixture(Engine,button,[1,1,1]);
      const result=engine.resolveShowdown(state);
      expect(result.totalPot).toBe(3);
      for(const pot of result.summary) {
        if(pot.payouts.length!==2 || pot.potAmount%2===0) continue;
        expect(pot.payouts.find(p=>p.payout===Math.ceil(pot.potAmount/2)).seatIndex).toBe(recipient);
      }
      expect(result.summary.some(p=>p.payouts.length===2 && p.potAmount%2===1)).toBe(true);
      expect(result.state.players.reduce((sum,p)=>sum+p.stack,0)).toBe(3);
    });
  }
  for (const Engine of [BadeuceyTripleDrawEngine,BadeuceySingleDrawEngine,BadaceyTripleDrawEngine,BadaceySingleDrawEngine]) {
    it(`${Engine.name}: five-card half receives the outer odd chip in a side-pot hand`,()=>{
      const {engine,state}=fixture(Engine,0,[5,5,3]);
      const result=engine.resolveShowdown(state);
      const main=result.summary.filter(p=>p.sourcePotIndex===0);
      expect(main.find(p=>p.component==='badugi')).toMatchObject({potAmount:4,oddChipAmount:0});
      expect(main.find(p=>p.component!=='badugi')).toMatchObject({potAmount:5,oddChipAmount:1});
      expect(result.state.players.reduce((sum,p)=>sum+p.stack,0)).toBe(13);
    });
  }
});
