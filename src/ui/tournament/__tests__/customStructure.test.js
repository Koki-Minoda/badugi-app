import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildTournamentConfigFromStage } from '../../../config/tournamentStages.js';
import { applyCustomStructure, structurePreset, validateStructure } from '../customStructure.js';
import { createMTTTournamentState, onTableHandCompleted } from '../../../games/badugi/engine/tournamentMTT.js';
afterEach(() => vi.useRealTimers());
describe('custom tournaments', () => {
  it('freezes a practice configuration independently of the edited draft', () => {
    const base = buildTournamentConfigFromStage('store');
    const draft = structurePreset('short',base.levels);
    const config = applyCustomStructure(base,draft);
    draft.levels[0].bb = 900;
    expect(config.levels[0].bb).not.toBe(900);
    expect(config).toMatchObject({ practiceOnly:true, entryFee:0, payouts:[], levelProgression:'clock' });
    expect(base.practiceOnly).toBeUndefined();
  });
  it('changes blinds only after the hand completes, preserving the deadline through save/resume', () => {
    vi.useFakeTimers(); vi.setSystemTime(100000);
    const base = buildTournamentConfigFromStage('store');
    const config = applyCustomStructure(base, structurePreset('short',base.levels));
    let state = createMTTTournamentState(config,[{id:'hero'},{id:'cpu'}]);
    const end = state.levelEndsAt;
    state = JSON.parse(JSON.stringify(state));
    vi.setSystemTime(end-1);
    state = onTableHandCompleted(state,'table-1',{handId:'one',seatResults:[]});
    expect(state.levelIndex).toBe(0);
    vi.setSystemTime(end+500);
    state = onTableHandCompleted(state,'table-1',{handId:'two',seatResults:[]});
    expect(state.levelIndex).toBe(1);
    const again = onTableHandCompleted(state,'table-1',{handId:'two',seatResults:[]});
    expect(again).toBe(state);
  });
  it('rejects bad blind orders, blank names and invalid durations', () => {
    const draft = structurePreset('short',buildTournamentConfigFromStage('store').levels);
    for (const input of [{...draft, name:''},{...draft, levelMinutes:0},{...draft, levels:[{sb:50,bb:10,ante:0}]}]) expect(() => validateStructure(input)).toThrow();
  });
});
