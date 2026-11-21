import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import CardPicker from '../CardPicker.jsx';
import BadugiEquityCalculator from '../BadugiEquityCalculator.jsx';
afterEach(cleanup);
it('edits starting cards only after opening the editor and preserves deck constraints', () => {
  function Setup() {
    const [cards, setCards] = useState(['AS', '2H', '3D', '4C']);
    return <><CardPicker bySuit cards={cards} count={4} blocked={['5S']} label="自分" ja onChange={setCards} /><output data-testid="cards">{cards.join(',')}</output></>;
  }
  render(<Setup />);
  fireEvent.click(screen.getAllByText('A♠')[0]);
  expect(screen.getByTestId('cards').textContent).toBe('AS,2H,3D,4C');
  expect(screen.getAllByText('A♠')[0].tagName).toBe('SPAN');
  expect(document.querySelector('details').open).toBe(false);
  fireEvent.click(screen.getByText('手札を編集'));
  fireEvent.click(screen.getByRole('button', { name: 'A♠', exact: true }));
  expect(screen.getByTestId('cards').textContent).toBe('2H,3D,4C');
  expect(screen.getByRole('button', { name: '5♠', exact: true }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'K♠', exact: true }));
  expect(screen.getByTestId('cards').textContent).toBe('2H,3D,4C,KS');
  expect(screen.getByRole('button', { name: '6♠', exact: true }).disabled).toBe(true);
});
it('selects discards without deleting cards from the starting hand', () => {
  render(<BadugiEquityCalculator ja />);
  const hero = within(screen.getByRole('group', { name: '自分 · 4/4' }));
  const discard = hero.getByRole('button', { name: 'K♥ を交換' });
  expect(discard.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(discard);
  expect(discard.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('group', { name: '自分 · 4/4' })).toBeTruthy();
  expect(hero.getByText('手札を編集')).toBeTruthy();
});

it('offers matching collapsed range editors and preserves both assumptions independently', () => {
  render(<BadugiEquityCalculator ja />);
  fireEvent.change(screen.getByRole('combobox', { name: '相手の手札の入力方法' }), { target: { value: 'range' } });
  for (const name of ['A', 'B']) {
    const editor = screen.getByTestId(`range-${name}-editor`);
    expect(editor.open).toBe(false);
    fireEvent.click(editor.querySelector('summary'));
    fireEvent.change(screen.getByLabelText(`レンジ${name}の手札と重み`), { target: { value: name === 'A' ? '9S 7C 5D 4H 3' : '8S 6C 4D 2H 1' } });
    expect(editor.querySelector('summary').textContent).toContain('入力1行');
  }
  expect(screen.getByLabelText('レンジAの手札と重み').value).toBe('9S 7C 5D 4H 3');
  expect(screen.getByLabelText('レンジBの手札と重み').value).toBe('8S 6C 4D 2H 1');
});
