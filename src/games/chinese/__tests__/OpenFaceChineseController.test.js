import { describe, it, expect } from 'vitest';
import OpenFaceChineseController, { replayOfcHistory } from '../OpenFaceChineseController.js';
import { evaluateOfcRows, qualifiesForFantasyland, scoreOfcPair } from '../ofcRules.js';
const play = c => { let n = 0; while (c.phase === 'placing' && n++ < 20) c.place(c.actor, c.suggestPlacement()); expect(c.phase).toBe('showdown'); return c; };
const fantasyRows = { front: ['QH','QS','2C'], middle: ['7C','7D','7H','AC','AD'], back: ['KC','KD','KH','KS','3D'] };
describe('Classic OFC', () => {
  it('deals five, then one, never permits moving committed cards, and records nine streets', () => {
    const c = new OpenFaceChineseController(); c.startNewHand();
    expect(c.players.map(p => p.pending.length)).toEqual([5,5]);
    const placement = c.suggestPlacement(); c.place(0, placement); c.playCpuTurns();
    expect(c.street).toBe(1); expect(c.players[0].pending).toHaveLength(1);
    expect(() => c.place(0, [placement[0]])).toThrow(/current cards/);
    const prior = JSON.stringify(c.players[0].rows);
    expect(() => c.place(1, c.suggestPlacement(1))).toThrow(/turn/);
    expect(JSON.stringify(c.players[0].rows)).toBe(prior);
    play(c);
    expect(c.events.filter(e=>e.type==='PLACE')).toHaveLength(18);
    expect(new Set(c.players.flatMap(p=>Object.values(p.rows).flat())).size).toBe(26);
    expect(c.result.points[0]+c.result.points[1]).toBe(0);
    expect(replayOfcHistory(c.history()).valid).toBe(true);
  });
  it('rejects repeated cards and full rows without changing state', () => {
    const c=new OpenFaceChineseController();c.startNewHand();const before=c.snapshot();
    expect(()=>c.place(0,c.players[0].pending.map(()=>({card:c.players[0].pending[0],row:'back'})))).toThrow();
    expect(c.snapshot()).toEqual(before);
    expect(()=>c.place(0,c.players[0].pending.map(card=>({card,row:'front'})))).toThrow(/full/);
    expect(c.snapshot()).toEqual(before);
  });
  it('qualifies with QQ, retains with strong rows, and rejects fouled Fantasyland', () => {
    const e=evaluateOfcRows(fantasyRows);expect(e.foul).toBe(false);
    expect(qualifiesForFantasyland(e)).toBe(true);expect(qualifiesForFantasyland(e,true)).toBe(true);
    expect(qualifiesForFantasyland({...e,foul:true})).toBe(false);
    const qqOnly=evaluateOfcRows({front:['QH','QS','2C'],middle:['KC','KD','4H','5C','6D'],back:['7C','8D','9H','10S','JC']});
    expect(qqOnly.foul).toBe(false);expect(qualifiesForFantasyland(qqOnly)).toBe(true);expect(qualifiesForFantasyland(qqOnly,true)).toBe(false);
  });
  it('deals thirteen in Fantasyland while the other seat still takes nine turns', () => {
    const c=new OpenFaceChineseController({fantasy:[true,false],dealer:0});c.startNewHand();
    expect(c.actor).toBe(0);expect(c.players[0].pending).toHaveLength(13);expect(c.players[1].pending).toHaveLength(5);
    play(c);expect(c.events.filter(e=>e.type==='PLACE'&&e.seat===0)).toHaveLength(1);expect(c.events.filter(e=>e.type==='PLACE'&&e.seat===1)).toHaveLength(9);
    expect(replayOfcHistory(c.history()).valid).toBe(true);
  });
  it('rejects forged replay placements, deals and scores', () => {
    const c=new OpenFaceChineseController();c.startNewHand();play(c);
    const h=c.history();h.result.points[0]++;expect(replayOfcHistory(h).valid).toBe(false);
    const deal=c.history();deal.events[0].cards.reverse();expect(replayOfcHistory(deal).valid).toBe(false);
  });
  it('awards standard row royalties and charges the winner’s royalties on a foul', () => {
    const e=evaluateOfcRows({front:['6C','6D','6H'],middle:['2S','3S','4S','5S','6S'],back:['10H','JH','QH','KH','AH']});
    expect(e.royalties).toEqual({front:14,middle:30,back:25,total:69});
    expect(scoreOfcPair({...e,foul:true},e).total).toBe(-75);
    expect(scoreOfcPair(e,{...e,foul:true}).total).toBe(75);
    expect(scoreOfcPair({...e,foul:true},{...e,foul:true}).total).toBe(0);
  });
  it('completes twenty seeded hands and replays every placement with conserved points', () => {
    let seed=123;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
    const c=new OpenFaceChineseController({random});
    for(let hand=0;hand<20;hand++){c.startNewHand();play(c);expect(replayOfcHistory(c.history()).valid).toBe(true);expect(c.scores[0]+c.scores[1]).toBe(0);}
  });
});
