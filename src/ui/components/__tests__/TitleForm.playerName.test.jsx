import React from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import { setLanguage } from '../../preferences/language.js';
import TitleForm from '../TitleForm.jsx';
import {getDefaultTitleSettings} from '../../utils/titleSettings.js';

afterEach(() => {cleanup(); vi.useRealTimers(); localStorage.clear(); setLanguage('ja');});
it('asks for a playing name instead of saving an email as the name', () => {
  const onSave = vi.fn();
  render(<TitleForm initialValues={getDefaultTitleSettings()} onSave={onSave}/>);
  fireEvent.change(screen.getByLabelText('プレイヤー名'), {target: {value: 'a@example.com'}});
  fireEvent.submit(screen.getByLabelText('プレイヤー名').closest('form'));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText('メールアドレスではなく、対局で使う名前を入力してください。')).toBeTruthy();
});
it('saves an actual nickname and explains where it is displayed and stored', () => {
  vi.useFakeTimers();
  const onSave = vi.fn();
  render(<TitleForm initialValues={getDefaultTitleSettings()} onSave={onSave}/>);
  fireEvent.change(screen.getByLabelText('プレイヤー名'), {target: {value: 'Koki'}});
  fireEvent.submit(screen.getByLabelText('プレイヤー名').closest('form'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({playerName: 'Koki'}));
  expect(screen.getByText(/対局中と優勝・順位画面に表示する名前/).textContent).toContain('このブラウザに保存');
});

it('uses English for editing, name validation, save and reset without changing saved values', () => {
  setLanguage('en');
  vi.useFakeTimers();
  const onSave = vi.fn();
  const onReset = vi.fn();
  render(<TitleForm initialValues={getDefaultTitleSettings()} onSave={onSave} onReset={onReset} />);
  expect(screen.getByLabelText('Title / badge')).toBeTruthy();
  expect(screen.getByLabelText('Avatar')).toBeTruthy();
  const name = screen.getByLabelText('Player name');
  fireEvent.change(name, { target: { value: 'local@example.test' } });
  fireEvent.submit(name.closest('form'));
  expect(screen.getByText('Use a player name instead of an email address.')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: 'Koki' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ playerName: 'Koki' }));
  expect(screen.getByText('Saved')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Defaults', exact: true }));
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Reset to defaults')).toBeTruthy();
});
