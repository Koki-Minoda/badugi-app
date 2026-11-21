import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
  expect(within(editor).getByRole('textbox', { name: 'プロフィール名' }).matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'プロフィール保存' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Mixed Game 開始' }).disabled).toBe(true);
});
it('keeps editing and start available after unlock', () => {
  progress.unlocked = true;
  show();
  expect(screen.getByTestId('mix-editor').disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'プロフィール保存' }).disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Mixed Game 開始' }).disabled).toBe(false);
});
