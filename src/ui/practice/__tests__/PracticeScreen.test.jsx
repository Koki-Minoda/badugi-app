import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, it, expect, vi } from 'vitest';
import PracticeScreen from '../PracticeScreen.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });
it('requires the correct number of distinct cards and does not start on selection alone', () => {
  render(<MemoryRouter><PracticeScreen /></MemoryRouter>);
  fireEvent.click(screen.getByText('選択をクリア'));
  fireEvent.click(screen.getByRole('button', { name: 'A♠', exact: true }));
  expect(screen.getByRole('button', { name: 'この手札で練習する' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'A♠', exact: true }));
  expect(screen.getByRole('button', { name: 'A♠', exact: true }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByTestId('practice-table')).toBeNull();
});
it('stops pending CPU work when leaving a hand and preserves setup for restarting', () => {
  vi.useFakeTimers();
  render(<MemoryRouter><PracticeScreen /></MemoryRouter>);
  fireEvent.click(screen.getByText('この手札で練習する'));
  expect(screen.getByTestId('practice-table')).toBeTruthy();
  fireEvent.click(screen.getByText('条件を変更'));
  act(() => { vi.advanceTimersByTime(2000); });
  expect(screen.queryByTestId('practice-table')).toBeNull();
  expect(screen.getByRole('button', { name: 'この手札で練習する' }).disabled).toBe(false);
});
