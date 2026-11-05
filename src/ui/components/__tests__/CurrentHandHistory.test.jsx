import React from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import CurrentHandHistory from '../CurrentHandHistory.jsx';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {configurable: true, value: vi.fn(function () { this.setAttribute('open', ''); })});
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {configurable: true, value: vi.fn(function () { this.removeAttribute('open'); })});
});
afterEach(() => {cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; vi.restoreAllMocks();});
const props = {handId: 'hand-1', actions: [{type: 'bet', label: 'Hero Raise 20'}]};

it('keeps the line hidden until one click, then closes and restores focus', () => {
  render(<CurrentHandHistory {...props}/>);
  const trigger = screen.getByRole('button', {name: '現ハンド履歴'});
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog').textContent).toContain('Hero Raise 20');
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '閉じる'}));
  fireEvent.click(screen.getByRole('button', {name: '閉じる'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('shows the complete chronological line beyond five entries and live updates', () => {
  const actions = Array.from({length: 25}, (_, i) => ({label: `Player Call ${i}`, type: 'bet'}));
  const {rerender} = render(<CurrentHandHistory {...props} actions={actions}/>);
  fireEvent.click(screen.getByRole('button', {name: '現ハンド履歴'}));
  expect(screen.getAllByRole('listitem')).toHaveLength(25);
  expect(screen.getAllByRole('listitem')[0].textContent).toContain('Player Call 0');
  rerender(<CurrentHandHistory {...props} actions={[...actions, {type: 'phase', label: 'BET -> DRAW'}]}/>);
  expect(screen.getAllByRole('listitem')).toHaveLength(26);
  expect(screen.getAllByRole('listitem')[25].textContent).toContain('BET -> DRAW');
});

it('closes on hand identity change instead of showing the next hand in the previous view', () => {
  const {rerender} = render(<CurrentHandHistory {...props}/>);
  fireEvent.click(screen.getByRole('button', {name: '現ハンド履歴'}));
  rerender(<CurrentHandHistory handId="hand-2" actions={[]}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '現ハンド履歴'}));
  expect(screen.getByRole('dialog').textContent).not.toContain('Hero Raise 20');
  expect(screen.getByRole('dialog').textContent).toContain('このハンドの操作はまだありません');
});

it('handles native cancel without navigating or dispatching an action', () => {
  const onHistory = vi.fn();
  render(<CurrentHandHistory {...props} onHistory={onHistory}/>);
  fireEvent.click(screen.getByRole('button', {name: '現ハンド履歴'}));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', {cancelable: true, bubbles: true}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onHistory).not.toHaveBeenCalled();
});

it('keeps saved history as a separate explicit destination', () => {
  const onHistory = vi.fn();
  render(<CurrentHandHistory {...props} language="en" onHistory={onHistory}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Hand line'}));
  fireEvent.click(screen.getByRole('button', {name: 'Saved hand history'}));
  expect(onHistory).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('cycles both directions even when Safari would skip button tab stops', () => {
  render(<CurrentHandHistory {...props} onHistory={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', {name: '現ハンド履歴'}));
  const sheet = screen.getByRole('dialog');
  fireEvent.keyDown(sheet, {key: 'Tab', shiftKey: true});
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '保存済みハンドの履歴へ'}));
  fireEvent.keyDown(sheet, {key: 'Tab'});
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '閉じる'}));
  fireEvent.keyDown(sheet, {key: 'Tab'});
  expect(document.activeElement).toBe(screen.getByLabelText('操作履歴'));
});
