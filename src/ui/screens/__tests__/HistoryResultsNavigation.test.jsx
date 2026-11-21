import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from '../HistoryScreen.jsx';
import HandHistoryScreen from '../HandHistoryScreen.jsx';
import { saveHandHistory, saveTournamentHandHistory } from '../../../utils/history.js';
import { setHandHistoryAccessors } from '../../state/handHistoryStore.js';

vi.mock('../../personalResults/PersonalResults.jsx', () => ({
  default: ({ hands, onBack, onReplay }) => <div>
    <h1>マイ結果</h1>
    <output data-testid="result-hands">{hands.map((hand) => hand.handId).join(',')}</output>
    <button onClick={onBack}>ハンド履歴へ戻る</button>
    <button onClick={() => onReplay('saved-cash', { actionSeqStart: 7 })}>この対局を見返す</button>
  </div>,
}));
vi.mock('../ReplayScreen.jsx', () => ({
  default: ({ initialHandSnapshot, target, onBack }) => <div>
    <output data-testid="replay-hand">{initialHandSnapshot.handId}:{target.actionSeqStart}</output>
    <button onClick={onBack}>結果へ戻る</button>
  </div>,
}));

const completed = (handId, endedAt) => ({ handId, endedAt, variantId: 'badugi', events: [{ type: 'HAND_END' }] });
afterEach(() => {
  cleanup();
  localStorage.clear();
  setHandHistoryAccessors({ readCurrent: () => null, readBuffer: () => [] });
});
function seed() {
  localStorage.setItem('mgx_auth', JSON.stringify({ accessToken: 'test-token' }));
  saveHandHistory(completed('saved-cash', 10));
  saveHandHistory(completed('duplicate', 20));
  saveTournamentHandHistory(completed('saved-tournament', 30));
  setHandHistoryAccessors({ readCurrent: () => null, readBuffer: () => [completed('duplicate', 40)] });
}

describe('history results navigation', () => {
  it('uses the same deduplicated saved and current hands from both entrances', () => {
    seed();
    render(<MemoryRouter><HistoryScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'マイ結果を見る' }));
    const routeHands = screen.getByTestId('result-hands').textContent;
    expect(routeHands).toBe('duplicate,saved-tournament,saved-cash');
    fireEvent.click(screen.getByRole('button', { name: 'ハンド履歴へ戻る' }));
    expect(screen.getByRole('heading', { name: 'キャッシュゲーム履歴' })).toBeTruthy();
    cleanup();
    render(<HandHistoryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'マイ結果を見る' }));
    expect(screen.getByTestId('result-hands').textContent).toBe(routeHands);
  });

  it('replays a saved hand after reload and returns to results', () => {
    seed();
    setHandHistoryAccessors({ readBuffer: () => [] });
    render(<MemoryRouter><HistoryScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'マイ結果を見る' }));
    fireEvent.click(screen.getByRole('button', { name: 'この対局を見返す' }));
    expect(screen.getByTestId('replay-hand').textContent).toBe('saved-cash:7');
    fireEvent.click(screen.getByRole('button', { name: '結果へ戻る' }));
    expect(screen.getByRole('heading', { name: 'マイ結果' })).toBeTruthy();
    expect(screen.getByTestId('result-hands').textContent).toBe('saved-tournament,duplicate,saved-cash');
  });
});
