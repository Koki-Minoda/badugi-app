import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import FinalDrawPractice from '../FinalDrawPractice.jsx';
afterEach(() => { cleanup(); localStorage.clear(); });
it.each([true, false])('explains BBet in the first question without opening assumptions (ja=%s)', ja => {
  render(<FinalDrawPractice userId="local-test" ja={ja} />);
  fireEvent.click(screen.getByRole('button', { name: ja ? '3rdドローを5問練習' : 'Practice five third draws' }));
  const context = screen.getByText(ja ? /BBet（最終ベット額の/ : /BBet \(.*the final-street bet\)/);
  expect(context.closest('details')).toBeNull();
  expect(screen.getByRole('combobox', { name: ja ? 'どのアクションを取る？' : 'What do you do?' })).toBeTruthy();
});
