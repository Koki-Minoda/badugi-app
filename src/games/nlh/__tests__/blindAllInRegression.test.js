import {it,expect} from 'vitest';
import NLH from '../NLHGameController.js';
import FLH from '../FLHGameController.js';
import PLO from '../../plo/PLOGameController.js';
import PLO8 from '../../plo/PLO8GameController.js';
for(const Controller of [NLH,FLH,PLO,PLO8]){
 it(`${Controller.name} settles a heads-up blind all-in without assigning an all-in actor`,()=>{
  const c=new Controller({tableConfig:{seats:[{name:'Hero',stack:10},{name:'CPU',stack:10}],blinds:{sb:10,bb:20}}});
  const s=c.startNewHand();
  expect(s.currentActor).toBeNull();expect(s.street).toBe('SHOWDOWN');
  expect(s.boardCards).toHaveLength(5);expect(s.lastHandResult).toBeTruthy();
  expect(s.players.reduce((n,p)=>n+p.stack,0)).toBe(20);
  const stacks=s.players.map(p=>p.stack);c.advanceStreet();
  expect(c.getSnapshot().street).toBe('SHOWDOWN');
  expect(c.getSnapshot().players.map(p=>p.stack)).toEqual(stacks);
 });
}
it('runs out and settles when the final caller becomes all-in during normal betting',()=>{
 const c=new NLH({tableConfig:{seats:[{name:'Hero',stack:30},{name:'CPU',stack:30}],blinds:{sb:5,bb:10}}});
 c.startNewHand();expect(c.applyPlayerAction({seatIndex:0,action:'raise',amount:25}).success).toBe(true);
 expect(c.applyPlayerAction({seatIndex:1,action:'call'}).success).toBe(true);
 const s=c.getSnapshot();expect(s.street).toBe('SHOWDOWN');expect(s.currentActor).toBeNull();
 expect(s.players.reduce((n,p)=>n+p.stack,0)).toBe(60);
});
it('skips an all-in small blind but still lets a funded big blind act',()=>{
 const c=new NLH({tableConfig:{seats:[{name:'Hero',stack:10},{name:'CPU',stack:100}],blinds:{sb:10,bb:20}}});
 const s=c.startNewHand();expect(s.players[0].allIn).toBe(true);expect(s.currentActor).toBe(1);
});
it('settles multiway ante all-ins with the full pot preserved',()=>{
 const c=new NLH({tableConfig:{seats:[0,1,2].map(i=>({name:`Seat ${i}`,stack:5})),blinds:{sb:10,bb:20,ante:5}}});
 const s=c.startNewHand();expect(s.currentActor).toBeNull();expect(s.street).toBe('SHOWDOWN');
 expect(s.players.reduce((n,p)=>n+p.stack,0)).toBe(15);
});
