import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  completeHand,
  validateUniqueActivePlayers,
  simulateBackgroundTables,
} from "../fixtures/buildTournamentTestFixture.js";
import {createMTTTournamentState, onTableHandCompleted} from '../../games/badugi/engine/tournamentMTT.js';

describe("tournament table rebalance", () => {
  it('preserves the actual app hero at a merge so background play cannot play their next hand', () => {
    const fixture = buildTournamentTestFixture('tableRebalance', {entrantCount: 8});
    const entrants = fixture.entrants.map(p => p.id === 'hero' ? {...p, id: 'hero-player', name: 'Local Player'} : p);
    const before = createMTTTournamentState(fixture.config, entrants);
    const table = before.tables[0];
    const bustIds = table.seats.filter(s => s.playerId && s.playerId !== 'hero-player').slice(0, 2).map(s => s.playerId);
    const summary = {handId:'merge-real-hero', handIndex:1, seatResults:table.seats.filter(s=>s.playerId).map(s=>({
      playerId:s.playerId, seatIndex:s.seatIndex, startingStack:500,
      stack:s.playerId==='hero-player'?1500:bustIds.includes(s.playerId)?0:500,
    }))};
    const merged = onTableHandCompleted(before, table.tableId, summary);
    expect(merged.tables.filter(t=>t.isActive)).toHaveLength(1);
    expect(merged.players['hero-player']).toMatchObject({tableId:table.tableId,seatIndex:0,stack:1500});
    const next = simulateBackgroundTables(merged, table.tableId, {maxHandsPerTable:3});
    expect(next.players).toEqual(merged.players);
    expect(Object.values(next.players).reduce((n,p)=>n+p.stack,0)).toBe(4000);
    expect(validateUniqueActivePlayers(next)).toEqual({valid:true,activePlayerCount:6});
    expect(onTableHandCompleted(next, table.tableId, summary)).toBe(next);
    expect(before.playersRemaining).toBe(8);
  });
  it('settles an 18-player tournament through 3 → 2 → 1 tables without losing chips, identities or placements', () => {
    const fixture = buildTournamentTestFixture('default', {entrantCount:18,config:{tables:3,prizePoolTotal:9000}});
    let state = createMTTTournamentState(fixture.config, fixture.entrants.map(p=>p.id==='hero'?{...p,id:'hero-player',name:'You'}:p));
    const counts = new Set([3]);
    let hand = 0;
    while(!state.isFinished) {
      const table = state.tables.find(t=>t.isActive&&t.seats.filter(s=>s.playerId).length>1);
      const participants = table.seats.filter(s=>s.playerId).map(s=>state.players[s.playerId]);
      const winner = participants.find(p=>p.id==='hero-player')??participants[0];
      const loser = participants.find(p=>p.id!==winner.id);
      const before = structuredClone(state);
      const summary={handId:`settled-${++hand}`,handIndex:hand,seatResults:participants.map(p=>({
        playerId:p.id,seatIndex:p.seatIndex,startingStack:p.stack,
        stack:p.id===loser.id?0:p.id===winner.id?p.stack+loser.stack:p.stack,
      }))};
      const updated = onTableHandCompleted(state,table.tableId,summary);
      expect(state).toEqual(before);
      expect(Object.values(updated.players).reduce((n,p)=>n+p.stack,0)).toBe(9000);
      expect(validateUniqueActivePlayers(updated)).toEqual({valid:true,activePlayerCount:updated.playersRemaining});
      expect(updated.players[loser.id]).toMatchObject({busted:true,stack:0,tableId:null,seatIndex:null,finishPlace:19-hand,bustHandIndex:hand});
      expect(onTableHandCompleted(updated,table.tableId,summary)).toBe(updated);
      counts.add(updated.tables.filter(t=>t.isActive).length);
      // Resume from a serialized boundary after each settlement, including merges.
      state=JSON.parse(JSON.stringify(updated));
    }
    expect([...counts]).toEqual([3,2,1]);
    expect(state.championId).toBe('hero-player');
    expect(state.events.filter(e=>e.type==='TABLE_MERGE'||e.type==='FINAL_TABLE').map(e=>[e.fromTables,e.toTables])).toEqual([[3,2],[2,1]]);
    expect(Object.values(state.players).map(p=>p.finishPlace).sort((a,b)=>a-b)).toEqual(Array.from({length:18},(_,i)=>i+1));
    expect(Object.values(state.players).reduce((n,p)=>n+p.payout,0)).toBe(9000);
    expect(state.players['hero-player'].stack).toBe(9000);
    expect(simulateBackgroundTables(state)).toBe(state);
  });
  it("removes empty tables and preserves unique active seating", () => {
    let state = buildTournamentTestFixture("tableRebalance").state;
    const toBust = Object.values(state.players).slice(0, 6);
    state = completeHand(
      state,
      state.tables[0].tableId,
      toBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        startingStack: player.stack,
        stack: 0,
      })),
    );

    expect(state.tables.filter((table) => table.isActive)).toHaveLength(1);
    const uniqueness = validateUniqueActivePlayers(state);
    expect(uniqueness.valid).toBe(true);
    expect(uniqueness.activePlayerCount).toBe(state.playersRemaining);
  });

  it("handles odd player counts without duplicate or missing players", () => {
    let state = buildTournamentTestFixture("tableRebalance").state;
    const toBust = Object.values(state.players).slice(0, 5);
    state = completeHand(
      state,
      state.tables[0].tableId,
      toBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        startingStack: player.stack,
        stack: 0,
      })),
    );

    const activeCounts = state.tables
      .filter((table) => table.isActive)
      .map((table) => table.seats.filter((seat) => seat.playerId).length);
    expect(Math.max(...activeCounts) - Math.min(...activeCounts)).toBeLessThanOrEqual(1);
    expect(validateUniqueActivePlayers(state).valid).toBe(true);
  });
});
