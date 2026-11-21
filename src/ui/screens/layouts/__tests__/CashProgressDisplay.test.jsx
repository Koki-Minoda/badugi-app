import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import GameLayoutBase from '../GameLayoutBase.jsx';
afterEach(cleanup);
function show({ cash = true, phase = 'BET', draw = 0, mixedRotation = null, debug = false } = {}) {
  return render(<GameLayoutBase headerProps={{ language: 'ja', ratingState: {}, rankInfo: {} }}
    sidePanelProps={{ seatViews: [], seatConfig: [], seatTypeOptions: [], totalPot: 30, notificationMessage: "ロード 0ms · 操作 waiting..." }}
    tableProps={{ seatViews: [], seatLayouts: [], heroDrawSelection: [], phase, tablePhase: phase, drawRoundValue: draw, betRoundValue: 0, tableSummaryProps: { maxDraws: 3 }, mixedRotation }}
    controlsProps={{ isCashGame: cash, actionPanelInfo: { waitingLabel: 'CPUの操作を待っています' } }}
    overlaysProps={{}} debugProps={{}} debugFlags={{ enabled: debug }} />);
}
it('shows one cash progress label and one waiting message', () => {
  show();
  expect(screen.getByTestId('table-phase-badge').textContent).toBe('ベット 1/4');
  expect(screen.queryByTestId('phase-compact-strip')).toBeNull();
  expect(screen.getAllByText('CPUの操作を待っています')).toHaveLength(1);
});
it('keeps draw progress and MIX rotation information', () => {
  show({ phase: 'DRAW', draw: 2, mixedRotation: { handsPlayedInCurrentGame: 1, handsPerGame: 4, nextName: 'Badugi' } });
  expect(screen.getByTestId('table-phase-badge').textContent).toBe('交換 3/3');
  expect(screen.getByTestId('mixed-rotation-status').textContent).toContain('MIX 2/4 · 次 Badugi');
});
it.each([0, 1, 2])('labels zero-based draw %i as the actual exchange number', (draw) => {
  show({ phase: 'DRAW', draw });
  expect(screen.getByTestId('table-phase-badge').textContent).toBe(`交換 ${draw + 1}/3`);
});
it('retains tournament phase controls', () => {
  show({ cash: false });
  expect(screen.getByTestId('phase-compact-strip')).toBeTruthy();
});

it('hides performance measurements in normal play while keeping player waiting guidance', () => {
  show();
  expect(screen.queryByText('ロード 0ms · 操作 waiting...')).toBeNull();
  expect(screen.getByText('CPUの操作を待っています')).toBeTruthy();
});
it('keeps performance measurements available in explicit debug mode', () => {
  show({ debug: true });
  expect(screen.getByText('ロード 0ms · 操作 waiting...')).toBeTruthy();
});
