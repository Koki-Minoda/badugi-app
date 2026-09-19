import { beforeEach, afterEach, describe,it,expect,vi } from 'vitest';
import { createMultiGameSeries,buildMultiGameConfig,recordMultiGameResult,multiGameVariantForTable,loadMultiGameSeries } from '../multiGameSeries.js';
import {createMTTTournamentState,onTableHandCompleted} from '../../../games/badugi/engine/tournamentMTT.js';
const sequence=['badugi','nlh','stud'];
describe('Multi-game tournaments',()=>{
 beforeEach(()=>localStorage.clear());
 afterEach(()=>vi.unstubAllGlobals());
 it('creates and restores distinct local series without secure-context UUID support',()=>{
  vi.stubGlobal('crypto',{});
  const first=createMultiGameSeries('stage',sequence);
  const second=createMultiGameSeries('survival',sequence);
  expect(first.id).toBeTruthy();expect(first.id).not.toBe(second.id);
  expect(loadMultiGameSeries()).toEqual(second);expect(buildMultiGameConfig(second).multiGame.seriesId).toBe(second.id);
 });
 it('keeps three independent stages and awards points only once per finished event',()=>{
  let s=createMultiGameSeries('stage',sequence);
  for(let i=0;i<3;i++){
   const cfg=buildMultiGameConfig(s);expect(cfg.gameVariant).toBe(sequence[i]);expect(cfg.rewards).toEqual([]);expect(cfg.payouts).toEqual([]);expect(cfg.prizePoolTotal).toBe(0);
   const state={config:cfg,isFinished:true,championId:'hero-player',tournamentRunId:`run${i}`};
   const placements=[{id:'hero-player',name:'You',place:1},{id:'cpu-1',name:'Mina',place:2}];
   recordMultiGameResult(state,placements);s=recordMultiGameResult(state,placements);
   expect(s.results).toHaveLength(i+1);expect(s.standings['hero-player'].points).toBe(6*(i+1));
  }
  expect(s.completed).toBe(true);expect(loadMultiGameSeries()).toEqual(s);
 });
 it('assigns different games to survival tables and changes only after three completed hands',()=>{
  const s=createMultiGameSeries('survival',sequence);const config=buildMultiGameConfig(s);
  let state=createMTTTournamentState(config,Array.from({length:18},(_,i)=>({id:`p${i}`})));
  expect(state.tables.map(t=>t.variantId)).toEqual(sequence);
  expect(multiGameVariantForTable(state,'table-1',{nextRotation:true})).toBe('nlh');
  expect(multiGameVariantForTable(state,'table-2',{nextRotation:true})).toBe('stud');
  const seats=state.tables[0].seats.map(s=>({playerId:s.playerId,seatIndex:s.seatIndex,stack:500}));
  for(let i=1;i<=3;i++){state=onTableHandCompleted(state,'table-1',{handId:`h${i}`,seatResults:seats});expect(multiGameVariantForTable(state,'table-1')).toBe(i<3?'badugi':'nlh');}
  const again=onTableHandCompleted(state,'table-1',{handId:'h3',seatResults:seats});expect(again.tables[0].totalHandsPlayed).toBe(3);
 });
 it('switches the championship final to the selected Dealer Choice order',()=>{
  const config=buildMultiGameConfig(createMultiGameSeries('championship',sequence,['stud','badugi']));
  const state={config,playersRemaining:7,tables:[{tableId:'t',totalHandsPlayed:3}]};
  expect(multiGameVariantForTable(state,'t')).toBe('nlh');state.playersRemaining=6;state.tables[0].finalStartHand=3;
  expect(multiGameVariantForTable(state,'t')).toBe('stud');
  expect(multiGameVariantForTable(state,'t',{nextRotation:true})).toBe('badugi');state.tables[0].totalHandsPlayed++;
  expect(multiGameVariantForTable(state,'t')).toBe('badugi');
 });
 it('does not count incomplete events or permit unsupported games',()=>{
  const s=createMultiGameSeries('stage',sequence);const cfg=buildMultiGameConfig(s);
  recordMultiGameResult({config:cfg,isFinished:false},[]);expect(loadMultiGameSeries().results).toHaveLength(0);
  expect(()=>createMultiGameSeries('stage',['ofc','nlh','stud'])).toThrow();
 });
});
