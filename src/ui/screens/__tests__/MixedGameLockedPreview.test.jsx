import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GAME_VARIANT_CATEGORIES } from '../../../games/config/variantCatalog.js';
import { listVariantProfiles } from '../../../games/config/variantProfiles.js';
import MixedGameScreen from '../MixedGameScreen.jsx';
import { MixedGameProvider } from '../../mixed/MixedGameContext.jsx';
const progress = vi.hoisted(() => ({ unlocked: false }));
vi.mock('../../hooks/usePlayerProgress.js', () => ({ usePlayerProgress: () => ({ worldChampCleared: progress.unlocked }) }));
beforeEach(() => { localStorage.clear(); progress.unlocked = false; });
afterEach(cleanup);
function show() { render(<MemoryRouter><MixedGameProvider><MixedGameScreen language="ja" /></MixedGameProvider></MemoryRouter>); }
it('allows preset preview without persisting changes and explains disabled editing', () => {
  show();
  const editor = screen.getByTestId('mix-editor');
  expect(editor.disabled).toBe(true);
  const before = localStorage.getItem('mixedGameProfiles');
  fireEvent.click(screen.getAllByRole('button', { name: '内容を見る', exact: true })[0]);
  expect(localStorage.getItem('mixedGameProfiles')).toBe(before);
  expect(screen.getByText('現在は閲覧のみ利用できます。世界大会で優勝すると、MIXの編集・保存・開始が解放されます。')).toBeTruthy();
  expect(within(editor).getByRole('textbox', { name: 'MIX名' }).matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'MIXを保存' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Mixed Game 開始' }).disabled).toBe(true);
});
it('keeps editing and start available after unlock', () => {
  progress.unlocked = true;
  show();
  expect(screen.getByTestId('mix-editor').disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'MIXを保存' }).disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Mixed Game 開始' }).disabled).toBe(false);
});

it('selects exclusions and reduced frequency by game names and saves the same IDs', () => {
  progress.unlocked = true;
  show();
  expect(screen.getByRole('textbox', { name: 'MIX名' })).toBeTruthy();
  fireEvent.click(screen.getByText('必ず除外する種目 · 指定なし'));
  fireEvent.click(within(screen.getByRole('group', { name: '必ず除外する種目' })).getByRole('checkbox', { name: 'Badugi', exact: true }));
  fireEvent.click(screen.getByText('出現しにくくする種目 · 指定なし'));
  fireEvent.click(within(screen.getByRole('group', { name: '出現しにくくする種目' })).getByRole('checkbox', { name: '2-7 Triple Draw', exact: true }));
  fireEvent.change(screen.getByLabelText('選択モード'), { target: { value: 'CATEGORY' } });
  const candidates = screen.getByRole('group', { name: 'ボード / ホールデム / オマハの候補' });
  fireEvent.click(within(candidates).getAllByRole('checkbox')[0]);
  fireEvent.change(screen.getByLabelText('ボード / ホールデム / オマハの出現比率'), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'MIXを保存' }));
  const saved = JSON.parse(localStorage.getItem('mixedGameProfiles')).find(profile => profile.hardBans?.includes('D03'));
  expect(saved.hardBans).toEqual(['D03']);
  expect(saved.softBans).toEqual(['D01']);
  expect(saved.categoryRules.pools[GAME_VARIANT_CATEGORIES.BOARD]).toEqual([listVariantProfiles().find(profile => profile.category === GAME_VARIANT_CATEGORIES.BOARD).id]);
  expect(saved.categoryRules.weights[GAME_VARIANT_CATEGORIES.BOARD]).toBe(2.5);
  expect(screen.queryByPlaceholderText('例: B09, ST4')).toBeNull();
});
