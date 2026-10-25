import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MixedGameProvider } from '../MixedGameContext.jsx';
import { useMixedGame } from '../useMixedGame.js';
import { advanceRotationState, buildProfileFromPreset, resolveInitialGame } from '../rotationUtils.js';
import { isMixedVariantPlayable } from '../mixedAvailability.js';

afterEach(() => { cleanup(); localStorage.clear(); });
const wrapper = ({ children }) => <MixedGameProvider>{children}</MixedGameProvider>;
describe('cash MIX session', () => {
  it('rotates Big O and all released Dramaha entries by catalog ID', () => {
    const ids = ['B07', 'H01', 'H02', 'H03', 'H04', 'H05', 'H06'];
    expect(ids.every(isMixedVariantPlayable)).toBe(true);
    expect(['CP1', 'CP2', 'S06'].some(isMixedVariantPlayable)).toBe(false);
    const { result } = renderHook(useMixedGame, { wrapper });
    act(() => result.current.activateProfile({ id: 'catalog-routing', selectedGameIds: ids, handsPerGame: 1 }));
    ids.forEach((id, index) => {
      expect(result.current.activeGameId).toBe(id);
      act(() => result.current.handleHandCompletion(`catalog-${index}`));
    });
    expect(result.current.activeGameId).toBe('B07');
    expect(result.current.runtimeState.history).toEqual(ids);
  });

  it('supports released board and stud controllers but preserves release gates', () => {
    expect(isMixedVariantPlayable('B01')).toBe(true);
    expect(isMixedVariantPlayable('ST1')).toBe(true);
    expect(isMixedVariantPlayable('B02')).toBe(true);
    expect(isMixedVariantPlayable('B03')).toBe(true);
    expect(isMixedVariantPlayable('B04')).toBe(true);
    expect(isMixedVariantPlayable('unknown')).toBe(false);
  });
  it('activates a freshly saved object and counts each completed hand once without stale renders', () => {
    const { result } = renderHook(useMixedGame, { wrapper });
    act(() => {
      const saved = result.current.saveProfile({ id: 'new', selectedGameIds: ['D02', 'D01'], handsPerGame: 2 });
      expect(result.current.activateProfile(saved).gameId).toBe('D02');
      result.current.handleHandCompletion('hand-1');
      result.current.handleHandCompletion('hand-1');
      result.current.handleHandCompletion('hand-2');
    });
    expect(result.current.runtimeState.activeGameId).toBe('D01');
    expect(result.current.runtimeState.history).toEqual(['D02', 'D02']);
    expect(result.current.remainingHands).toBe(2);
    act(() => result.current.deactivateMixedGame());
    expect(result.current.isMixedMode).toBe(false);
  });
  it('holds a session snapshot even if the saved template is edited', () => {
    const { result } = renderHook(useMixedGame, { wrapper });
    act(() => result.current.activateProfile({ id: 'running', selectedGameIds: ['D02', 'D01'], handsPerGame: 1 }));
    act(() => result.current.saveProfile({ id: 'running', selectedGameIds: ['D03'], handsPerGame: 30 }));
    act(() => result.current.handleHandCompletion('hand-1'));
    expect(result.current.activeGameId).toBe('D01');
  });
  it('preserves deliberate duplicate entries and applies hard exclusions in fixed and random modes', () => {
    const profile = buildProfileFromPreset({ selectedGameIds: ['D01', 'D03', 'D01'], allowDuplicates: true, handsPerGame: 2.8, hardBans: ['D01'] });
    expect(profile.selectedGameIds).toEqual(['D01', 'D03', 'D01']);
    expect(profile.handsPerGame).toBe(2);
    expect(resolveInitialGame(profile, 'FIXED', () => true).gameId).toBe('D03');
    expect(resolveInitialGame(profile, 'RANDOM', () => true).gameId).toBe('D03');
    expect(advanceRotationState({ activeGameId: 'D03', currentIndex: 1, handsPlayedInCurrentGame: 1 }, profile, () => true).nextGameId).toBe('D03');
  });
  it('selects a playable category and respects weighted exclusions', () => {
    const profile = buildProfileFromPreset({ selectedGameIds: ['D01', 'D02'], selectionMode: 'CATEGORY', categoryRules: { weights: { board: 100, 'triple-draw': 1 }, pools: { board: ['B04'], 'triple-draw': ['D02'] } } });
    // Simulate an unavailable category without tying this case to release timing.
    expect(resolveInitialGame(profile, null, id => id !== 'B04' && isMixedVariantPlayable(id)).gameId).toBe('D02');
    const weighted = buildProfileFromPreset({ selectedGameIds: ['D01', 'D02'], selectionMode: 'WEIGHTED', weightedTable: { D01: 1000, D02: 1 }, hardBans: ['D01'] });
    expect(resolveInitialGame(weighted, null, isMixedVariantPlayable).gameId).toBe('D02');
    expect(resolveInitialGame({ ...weighted, hardBans: ['D01', 'D02'] }, null, isMixedVariantPlayable)).toBeNull();
  });
  it('does not change a saved tournament session when starting or ending cash MIX', () => {
    localStorage.setItem('session.tournament.active', JSON.stringify({ id: 'existing', mixedState: { profileId: 'old' } }));
    const before = localStorage.getItem('session.tournament.active');
    const { result } = renderHook(useMixedGame, { wrapper });
    act(() => result.current.activateProfile({ selectedGameIds: ['D02'] }));
    act(() => result.current.deactivateMixedGame());
    expect(localStorage.getItem('session.tournament.active')).toBe(before);
  });
});
it('migrates an old standard preset without losing a custom hand count',()=>{
 localStorage.setItem('mixedGameProfiles',JSON.stringify([{id:'mix-horse-pro',name:'HORSE Pro',selectedGameIds:['B02','B06','ST3','ST1','ST2'],handsPerGame:3,selectionMode:'FIXED'}]));
 const {result}=renderHook(useMixedGame,{wrapper});
 const horse=result.current.profiles[0];expect(horse.selectedGameIds).toEqual(['B02','B09','ST3','ST1','ST2']);expect(horse.handsPerGame).toBe(3);expect(horse.selectedGameIds.every(isMixedVariantPlayable)).toBe(true);
});
