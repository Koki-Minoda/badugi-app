import React from 'react';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import OpenFaceChineseScreen from '../OpenFaceChineseScreen.jsx';
import {formatCardLabel} from '../../utils/cardLabel.js';
import {setLanguage} from '../../preferences/language.js';

describe('OFC card placement labels', () => {
  afterEach(() => { cleanup(); setLanguage('ja'); });

  it('shows the same suit symbol as the card in the Japanese and English placement buttons', () => {
    setLanguage('ja');
    render(<OpenFaceChineseScreen guest onBack={() => {}} />);

    const selectedCard = screen.getAllByTestId(/^ofc-pending-/)[0];
    const code = selectedCard.getAttribute('data-testid').replace('ofc-pending-', '');
    const label = formatCardLabel(code);
    expect(selectedCard.getAttribute('aria-label')).toBe(label);
    expect(screen.getByTestId('ofc-place-front').textContent).toBe(`${label} を配置`);

    act(() => setLanguage('en'));
    expect(screen.getByTestId('ofc-place-front').textContent).toBe(`Place ${label}`);
  });

  it('formats all four suits without exposing the internal card code', () => {
    expect(['AS', '10H', 'QD', '2C'].map(formatCardLabel)).toEqual(['A♠', '10♥', 'Q♦', '2♣']);
  });
});
