import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MixedGameProvider } from '../../mixed/MixedGameContext.jsx';
import LearningHubScreen from '../LearningHubScreen.jsx';
import VariantRuleReminder from '../VariantRuleReminder.jsx';
import LearningGameLaunch from '../LearningGameLaunch.jsx';
import MixedGameScreen from '../../screens/MixedGameScreen.jsx';
import { getLearningGame, getRuleRows, LEARNING_PRESETS } from '../learningCatalog.js';
import { LANGUAGE_STORAGE_KEY } from '../../../config/mgxLocaleConfig.js';
import { DeuceToSevenSingleDrawController } from '../../../games/draw/DeuceToSevenSingleDrawController.js';

vi.mock('../../../games/config/canLaunchVariant.js', () => ({ canLaunchVariant: id => ({ canLaunch: id !== 'flh' }) }));
vi.mock('../../hooks/usePlayerProgress.js', () => ({ usePlayerProgress: () => ({ tournament: { wins: {} } }) }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderHub = (url = '/learn') => render(<MemoryRouter initialEntries={[url]}><MixedGameProvider><Routes><Route path="/learn" element={<LearningHubScreen />} /><Route path="/mixed" element={<MixedGameScreen language="ja" />} /></Routes></MixedGameProvider></MemoryRouter>);

describe('learning rules and template contracts', () => {
  it('compares A-5 and 2-7 only on changed rules and resolves catalog aliases', () => {
    expect(getLearningGame('D01').id).toBe('deuce_to_seven_triple_draw');
    expect(getRuleRows('D01', 'en', 'D02').filter(r => r.changed).map(r => r.key)).toEqual(['outcome']);
    expect(getRuleRows('unknown')).toEqual([]);
  });
  it('keeps HORSE fixed-limit Omaha and the eight-game sequence complete', () => {
    expect(LEARNING_PRESETS[1].selectedGameIds).toEqual(['B02', 'B09', 'ST3', 'ST1', 'ST2']);
    for (const p of LEARNING_PRESETS) {
      expect(new Set(p.selectedGameIds).size).toBe(p.selectedGameIds.length);
      expect(p.selectedGameIds.every(id => getLearningGame(id))).toBe(true);
    }
    expect(LEARNING_PRESETS[2].selectedGameIds).toHaveLength(8);
  });
  it('matches MGX single-draw betting instead of assuming the conventional no-limit format', () => {
    const controller = new DeuceToSevenSingleDrawController({ tableConfig: { seatConfig: ['HUMAN', 'CPU'], startingStack: 500, structure: { sb: 10, bb: 20 } } });
    const state = controller.createNewHandState(controller.createInitialState());
    expect(state.snapshot.metadata.bettingStructure).toBe(getLearningGame('S01').betting);
  });
});

describe('learning routes', () => {
  it('imports an unsaved deep link while preserving a previously edited template', () => {
    const view = renderHub('/mixed?preset=learn-horse');
    let profiles = JSON.parse(localStorage.getItem('mixedGameProfiles'));
    expect(profiles.find(p => p.id === 'learn-horse').handsPerGame).toBe(4);
    view.unmount();
    profiles = profiles.map(p => p.id === 'learn-horse' ? { ...p, name: 'My HORSE', handsPerGame: 12, selectedGameIds: ['D03'] } : p);
    localStorage.setItem('mixedGameProfiles', JSON.stringify(profiles));
    renderHub('/learn?plan=learn-horse');
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));
    fireEvent.click(screen.getByRole('link', { name: 'MIX設定で確認' }));
    expect(screen.getAllByDisplayValue('My HORSE').length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('mixedGameProfiles')).find(p => p.id === 'learn-horse').handsPerGame).toBe(12);
  });
  it('requests only one hand initialization under React StrictMode', () => {
    const start = vi.fn();
    const view = render(<React.StrictMode><LearningGameLaunch variantId="D02" onLaunch={start} /></React.StrictMode>);
    expect(start).toHaveBeenCalledExactlyOnceWith('D02');
    view.rerender(<React.StrictMode><LearningGameLaunch variantId="D02" onLaunch={() => start('again')} /></React.StrictMode>);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it('highlights a transition and starts the selected public game', () => {
    renderHub('/learn?plan=learn-lowball');
    fireEvent.click(screen.getByRole('button', { name: '2. 2-7 Triple Draw' }));
    expect(screen.getByRole('heading', { name: 'A-5 Triple Draw → 2-7 Triple Draw' })).toBeTruthy();
    expect(screen.getAllByText(/変更点 ·/)).toHaveLength(1);
    expect(screen.getByTestId('learn-play').getAttribute('href')).toBe('/game?variant=deuce_to_seven_triple_draw');
  });
  it('preserves release gating for a rules-only game', () => {
    renderHub('/learn?variant=flh');
    expect(screen.queryByTestId('learn-play')).toBeNull();
    expect(screen.getByText(/ルールの確認のみ/)).toBeTruthy();
  });
  it('saves without duplicates, survives a remount and imports to the existing locked builder', () => {
    const view = renderHub('/learn?plan=learn-horse');
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));
    const saved = JSON.parse(localStorage.getItem('mixedGameProfiles')).filter(p => p.id === 'learn-horse');
    expect(saved).toHaveLength(1);
    expect(saved[0].selectedGameIds).toEqual(['B02', 'B09', 'ST3', 'ST1', 'ST2']);
    view.unmount();
    renderHub('/learn?plan=learn-horse');
    fireEvent.click(screen.getByRole('link', { name: 'MIX設定で確認' }));
    expect(screen.getAllByDisplayValue('HORSE Practice')[0]).toBeTruthy();
  });
  it('imports an unsaved plan and does not claim storage success if writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    renderHub('/learn?plan=learn-lowball');
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));
    expect(screen.getByRole('status').textContent).toContain('保存はできませんでした');
    fireEvent.click(screen.getByRole('link', { name: 'MIX設定で確認' }));
    expect(screen.getAllByDisplayValue('Lowball Basics')[0]).toBeTruthy();
  });
  it('persists the language and handles invalid deep links', () => {
    renderHub('/learn?plan=unknown&variant=unknown');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'en' } });
    expect(screen.getByRole('heading', { name: 'Learn a game. Play a hand.' })).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});

describe('in-game rule reminder', () => {
  it('updates on rotation, closes stale rules, supports Escape and restores focus', () => {
    const view = render(<VariantRuleReminder variantId="D02" />);
    const trigger = screen.getByTestId('game-rule-reminder');
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '閉じる' }));
    view.rerender(<VariantRuleReminder variantId="D01" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger.textContent).toContain('種目切替');
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: 'A-5 Triple Draw → 2-7 Triple Draw' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('does not fabricate rules for an unsupported game or trigger a change for aliases', () => {
    const view = render(<VariantRuleReminder variantId="D03" />);
    view.rerender(<VariantRuleReminder variantId="badugi" />);
    expect(screen.getByTestId('game-rule-reminder').textContent).toBe('ルール');
    view.rerender(<VariantRuleReminder variantId="unknown" />);
    expect(screen.queryByTestId('game-rule-reminder')).toBeNull();
  });
});
