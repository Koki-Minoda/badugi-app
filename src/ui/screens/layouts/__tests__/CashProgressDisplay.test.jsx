import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import GameLayoutBase from '../GameLayoutBase.jsx';
afterEach(cleanup);
function show({ cash = true, phase = 'BET', draw = 0, mixedRotation = null } = {}) {
  return render(<GameLayoutBase headerProps={{ language: 'ja', ratingState: {}, rankInfo: {} }}
    sidePanelProps={{ seatViews: [], seatConfig: [], seatTypeOptions: [], totalPot: 30 }}
    tableProps={{ seatViews: [], seatLayouts: [], heroDrawSelection: [], phase, tablePhase: phase, drawRoundValue: draw, betRoundValue: 0, tableSummaryProps: { maxDraws: 3 }, mixedRotation }}
    controlsProps={{ isCashGame: cash, actionPanelInfo: { waitingLabel: 'CPUの操作を待っています' } }}
    overlaysProps={{}} debugProps={{}} />);
}
it('shows one cash progress label and one waiting message', () => {
  show();
  expect(screen.getByTestId('table-phase-badge').textContent).toBe('ベット 1/4');
  expect(screen.queryByTestId('phase-compact-strip')).toBeNull();
  expect(screen.getAllByText('CPUの操作を待っています')).toHaveLength(1);
});
it('keeps draw progress and MIX rotation information', () => {
  show({ phase: 'DRAW', draw: 2, mixedRotation: { handsPlayedInCurrentGame: 1, handsPerGame: 4, nextName: 'Badugi' } });
  expect(screen.getByTestId('table-phase-badge').textContent).toBe('交換 2/3');
  expect(screen.getByTestId('mixed-rotation-status').textContent).toContain('MIX 2/4 · 次 Badugi');
});
it('retains tournament phase controls', () => {
  show({ cash: false });
  expect(screen.getByTestId('phase-compact-strip')).toBeTruthy();
});
