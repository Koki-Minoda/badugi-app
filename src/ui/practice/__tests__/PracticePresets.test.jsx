import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, it, expect, vi } from 'vitest';
import PracticeScreen from '../PracticeScreen.jsx';
import ReviewScreen from '../../review/ReviewScreen.jsx';
import { saveReview } from '../../review/reviewStore.js';
import { PRESET_STORAGE_KEY, readPracticePresets, savePracticePreset } from '../practicePresetStore.js';
const setup = { variant: 'badugi', cards: ['AS', '2H', '3D', '4C'] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
function show(url = '/learn/practice') { return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/learn/practice" element={<PracticeScreen />} /><Route path="/learn/review" element={<ReviewScreen />} /></Routes></MemoryRouter>); }
it('opens a saved hand as a setup without starting a CPU timer', () => {
  saveReview({ handId: 'from-review', variantId: 'badugi', seats: [{ seat: 0, initialHand: setup.cards }] });
  show('/learn/review');
  screen.getByTestId('saved-hand').open = true;
  fireEvent.click(screen.getByRole('link', { name: 'この開始手札で練習' }));
  expect(screen.getByRole('button', { name: '4♣' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByTestId('practice-table')).toBeNull();
});
it('shows reasons for unsupported and incomplete records', () => {
  saveReview({ handId: 'unsupported', variantId: 'stud' });
  saveReview({ handId: 'missing', variantId: 'badugi', seats: [{ seat: 0, hand: setup.cards }] });
  show('/learn/review');
  for (const row of screen.getAllByTestId('saved-hand')) row.open = true;
  expect(screen.getByText(/この種目は配牌練習に未対応/)).toBeTruthy();
  expect(screen.getByText(/開始手札が完全に記録されていない/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'この開始手札で練習' })).toBeNull();
});
it('rejects invalid URL conditions without silently dealing a default hand', () => {
  show('/learn/practice?variant=badugi&cards=AS,AS,3D,4C');
  expect(screen.getByRole('alert').textContent).toContain('練習条件を読み込めませんでした');
  expect(screen.getByRole('button', { name: 'この手札で練習する' }).disabled).toBe(true);
});
it('saves, reloads the exact setup, handles duplicate names, cancels removal, then removes', () => {
  show();
  fireEvent.change(screen.getByLabelText('練習条件の名前'), { target: { value: 'My setup' } });
  fireEvent.click(screen.getByText('現在の条件を保存'));
  const saved = readPracticePresets().entries[0];
  expect(saved.name).toBe('My setup');
  fireEvent.change(screen.getByLabelText('練習条件の名前'), { target: { value: 'My setup' } });
  fireEvent.click(screen.getByText('現在の条件を保存'));
  expect(screen.getByRole('alert').textContent).toContain('同じ名前');
  fireEvent.change(screen.getByLabelText('種目'), { target: { value: 'ace_to_five_triple_draw' } });
  fireEvent.click(screen.getByText('この条件を呼び出す'));
  expect(screen.getByLabelText('種目').value).toBe('badugi');
  expect(screen.getByRole('button', { name: '3♣' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByTestId('practice-table')).toBeNull();
  fireEvent.click(screen.getByText('保存した条件を削除'));
  fireEvent.click(screen.getByText('キャンセル'));
  expect(readPracticePresets().entries).toHaveLength(1);
  fireEvent.click(screen.getByText('保存した条件を削除'));
  fireEvent.click(screen.getByText('削除する'));
  expect(readPracticePresets().entries).toHaveLength(0);
  expect(screen.getByRole('button', { name: '3♣' }).getAttribute('aria-pressed')).toBe('true');
});
it('keeps the name on storage failure and reflects another tab removing a setup', () => {
  const saved = savePracticePreset('Existing', setup);
  show();
  fireEvent.change(screen.getByLabelText('保存した練習条件'), { target: { value: saved.id } });
  fireEvent.change(screen.getByLabelText('練習条件の名前'), { target: { value: 'Keep input' } });
  const mock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByText('現在の条件を保存'));
  expect(screen.getByLabelText('練習条件の名前').value).toBe('Keep input');
  expect(screen.getByRole('alert').textContent).toContain('保存できませんでした');
  mock.mockRestore();
  act(() => { localStorage.removeItem(PRESET_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PRESET_STORAGE_KEY })); });
  expect(screen.queryByText('この条件を呼び出す')).toBeNull();
});
