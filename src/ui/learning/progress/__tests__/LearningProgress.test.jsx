import React from 'react';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import LearningDashboard from '../LearningDashboard.jsx';
import RuleQuizScreen from '../../RuleQuizScreen.jsx';
import ReviewScreen from '../../../review/ReviewScreen.jsx';
import { saveReview } from '../../../review/reviewStore.js';
import { savePracticePreset } from '../../../practice/practicePresetStore.js';
import { PROGRESS_STORAGE_KEY, readLearningProgress, recordQuizAnswer } from '../progressStore.js';
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
const show = (path = '/learn') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/learn" element={<LearningDashboard language="ja" />} /><Route path="/learn/quiz" element={<RuleQuizScreen />} /><Route path="/learn/review" element={<ReviewScreen />} /></Routes></MemoryRouter>);
it('starts with honest empty metrics and a first-lesson link', () => {
  show();
  expect(screen.getByTestId('learning-totals').textContent).toContain('—');
  expect(screen.getByRole('link', { name: '種目切り替えのルールを6問' }).getAttribute('href')).toBe('/learn/quiz?topic=draw_rules');
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
});
it('offers pending reviews and saved practice, and marking reviewed updates the home counts', () => {
  saveReview({ handId: 'review-1', variantId: 'badugi' });
  savePracticePreset('Named setup', { variant: 'badugi', cards: ['AS', '2H', '3D', '4C'] });
  show();
  expect(screen.getByRole('link', { name: /Named setup/ }).getAttribute('href')).toContain('cards=AS');
  fireEvent.click(screen.getByRole('link', { name: /未復習のハンドを振り返る/ }));
  screen.getByTestId('saved-hand').open = true;
  fireEvent.click(screen.getByRole('button', { name: '復習済みにする' }));
  expect(screen.queryByTestId('saved-hand')).toBeNull();
  fireEvent.change(screen.getByLabelText('復習状況'), { target: { value: 'done' } });
  screen.getByTestId('saved-hand').open = true;
  expect(screen.getByRole('button', { name: '復習済み・未復習に戻す' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('link', { name: '学習に戻る' }));
  expect(screen.getByTestId('learning-totals').textContent).toContain('1/1');
});
it('persists a wrong answer across screens, retries it and clears the missed suggestion', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  show('/learn/quiz?topic=badugi');
  fireEvent.click(screen.getByRole('button', { name: '1枚' }));
  fireEvent.click(screen.getByRole('button', { name: '1枚' }));
  expect(Object.keys(readLearningProgress().data.answers)).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: '学習に戻る' }));
  fireEvent.click(screen.getByRole('link', { name: /間違えたクイズを復習/ }));
  expect(screen.getByText('1 / 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '4枚' }));
  fireEvent.click(screen.getByRole('button', { name: '結果を見る' }));
  fireEvent.click(screen.getByRole('link', { name: '学習に戻る' }));
  expect(screen.queryByRole('link', { name: /間違えたクイズを復習/ })).toBeNull();
  expect(screen.getByTestId('learning-totals').textContent).toContain('50%');
});
it('retains failed quiz writes and retries them without duplicate attempts', () => {
  show('/learn/quiz?topic=badugi');
  const mock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByRole('button', { name: '1枚' }));
  expect(screen.getByRole('alert').textContent).toContain('保存できませんでした');
  mock.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: '進捗の保存を再試行' }));
  expect(Object.keys(readLearningProgress().data.answers)).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('does not display zero progress as if valid when storage is corrupt', () => {
  localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken'); show();
  expect(screen.getByRole('alert').textContent).toContain('読み込めません');
  expect(screen.queryByTestId('learning-totals')).toBeNull();
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe('{broken');
});
it('refreshes metrics when another tab updates progress', () => {
  show();
  act(() => recordQuizAnswer({ attemptId: 'a', questionId: 'badugi-0', correct: true }));
  expect(screen.getByTestId('learning-totals').textContent).toContain('100%');
  act(() => { localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })); });
  expect(screen.getByTestId('learning-totals').textContent).toContain('—');
});
it('leaves missed-question mode when starting a new round from an empty queue', () => {
  show('/learn/quiz?retry=missed');
  expect(screen.getByText('復習する問題はありません')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: '新しく6問' }));
  expect(screen.getByLabelText('練習テーマ').value).toBe('draw_rules');
  expect(screen.getByText('1 / 6')).toBeTruthy();
});
it('distinguishes unavailable missed questions from a successfully cleared queue', () => {
  localStorage.setItem(PROGRESS_STORAGE_KEY, '{broken');
  show('/learn/quiz?retry=missed');
  expect(screen.getByText('保存した問題を確認できません')).toBeTruthy();
  expect(screen.queryByText('復習する問題はありません')).toBeNull();
});
