import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewScreen from '../ReviewScreen.jsx';
import SavedHandDetails from '../SavedHandDetails.jsx';
import HandResultOverlay from '../../components/HandResultOverlay.jsx';
import { setHandHistoryAccessors } from '../../state/handHistoryStore.js';
import ReviewBookmarkButton from '../ReviewBookmarkButton.jsx';
import { saveReview, readReviews, REVIEW_STORAGE_KEY } from '../reviewStore.js';
const hand = { handId: 'saved-hand-1', variantId: 'D02', startedAt: 10, events: [{ type: 'BET_ACTION', seat: 0, action: 'call', amount: 20 }, { type: 'HAND_END', totalPot: 40 }] };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('shows an empty state and a learning navigation link', () => {
  render(<MemoryRouter><ReviewScreen /></MemoryRouter>);
  expect(screen.getByText(/復習したいハンドを/)).toBeTruthy();
  expect(screen.getByRole('link', { name: '学習に戻る' }).getAttribute('href')).toBe('/learn');
});
it('edits notes, searches, filters and removes with cancellation', () => {
  saveReview(hand);
  saveReview({ ...hand, handId: 'other', variantId: 'badugi' }, { tags: ['他'] });
  render(<MemoryRouter><ReviewScreen /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('種目'), { target: { value: 'ace_to_five_triple_draw' } });
  expect(screen.getAllByTestId('saved-hand')).toHaveLength(1);
  const item = screen.getByTestId('saved-hand');
  item.open = true;
  fireEvent.change(within(item).getByLabelText('メモ'), { target: { value: 'リバーの判断 <script>text</script>' } });
  fireEvent.change(within(item).getByLabelText('タグ（カンマ区切り）'), { target: { value: 'リバー、復習' } });
  fireEvent.click(within(item).getByText('メモとタグを保存'));
  expect(readReviews().entries.find(e => e.hand.handId === hand.handId).tags).toEqual(['リバー', '復習']);
  fireEvent.change(screen.getByLabelText('タグ'), { target: { value: 'リバー' } });
  fireEvent.change(screen.getByLabelText('メモ・ハンドを検索'), { target: { value: '一致しない' } });
  expect(screen.queryAllByTestId('saved-hand')).toHaveLength(0);
  fireEvent.click(screen.getByText('絞り込みを解除'));
  const saved = screen.getAllByTestId('saved-hand')[0]; saved.open = true;
  expect(within(saved).getByText(/Seat 0 · コール · 20/)).toBeTruthy();
  fireEvent.click(within(saved).getByText('復習から解除'));
  fireEvent.click(within(saved).getByText('キャンセル'));
  expect(readReviews().entries).toHaveLength(2);
  fireEvent.click(within(saved).getByText('復習から解除'));
  fireEvent.click(within(saved).getByText('解除する'));
  expect(readReviews().entries).toHaveLength(1);
});
it('does not report successful save when storage fails', () => {
  render(<ReviewBookmarkButton hand={hand} language="ja" />);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByRole('button', { name: 'あとで復習に保存' }));
  expect(screen.getByRole('alert').textContent).toContain('端末に保存できませんでした');
  expect(screen.queryByText('復習に保存済み')).toBeNull();
});
it('updates another mounted save button and responds to cross-tab storage changes', () => {
  render(<><ReviewBookmarkButton hand={hand} /><ReviewBookmarkButton hand={hand} /></>);
  fireEvent.click(screen.getAllByText('あとで復習に保存')[0]);
  expect(screen.getAllByText('復習に保存済み')).toHaveLength(2);
  act(() => { localStorage.removeItem(REVIEW_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: REVIEW_STORAGE_KEY })); });
  expect(screen.getAllByText('あとで復習に保存')).toHaveLength(2);
});

it('saves by canonical history ID when the result uses a different controller ID', () => {
  setHandHistoryAccessors({ findById: id => id === hand.handId ? hand : null });
  render(<HandResultOverlay visible language="ja" reviewHandId={hand.handId} summary={{ handId: 'controller-hand-1', pot: 40 }} />);
  fireEvent.click(screen.getByText('あとで復習に保存'));
  expect(readReviews().entries[0].hand.handId).toBe(hand.handId);
  setHandHistoryAccessors({ findById: () => null });
});

it('shows recorded hero cards and legacy stack fields without displaying opponent hole cards', () => {
  render(<SavedHandDetails language="ja" hand={{ ...hand, seats: [
    { seat: 0, isHero: true, name: 'Hero', initialHand: ['AS', '2H'], hand: ['3D', '4C'], startStack: 500, endStack: 520 },
    { seat: 1, name: 'CPU', initialHand: ['KS', 'KH'], hand: ['KS', 'KH'], startStack: 500, endStack: 480 },
  ] }} />);
  expect(screen.getByText('A♠')).toBeTruthy();
  expect(screen.getByText('3♦')).toBeTruthy();
  expect(screen.getByText('500 → 520')).toBeTruthy();
  expect(screen.queryByText('K♠')).toBeNull();
});
