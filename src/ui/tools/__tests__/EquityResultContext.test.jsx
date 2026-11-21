import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BadugiEquityCalculator from '../BadugiEquityCalculator.jsx';

vi.mock('../useBadugiCalculation.js', () => ({
  useBadugiCalculation: request => ({ current: request?.hands ? { data: { showdown: {
    outcomes: 1, availableCards: 44, method: 'exact',
    players: [{ equity: 1, wins: 1, ties: 0, losses: 0 }, { equity: 0, wins: 0, ties: 0, losses: 1 }],
  } } } : null }),
}));
afterEach(cleanup);
it('identifies range A details separately from A/B comparison and updates draw conditions', () => {
  render(<BadugiEquityCalculator ja />);
  fireEvent.change(screen.getByRole('combobox', { name: '相手の手札の入力方法' }), { target: { value: 'range' } });
  const details = within(screen.getByTestId('equity-detail-results'));
  expect(details.getByRole('heading', { name: 'レンジAの詳細結果' })).toBeTruthy();
  expect(details.getByText(/自分: K♥ を交換 · 相手: 0枚交換 · 残り1ドロー/)).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: '残りドロー' }), { target: { value: '0' } });
  expect(details.getByText(/最終手札.*相手: 交換なし.*残り0ドロー/)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '2つのレンジで判断を比べる' })).toBeNull();
});
