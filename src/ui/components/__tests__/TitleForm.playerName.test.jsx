import React from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import TitleForm from '../TitleForm.jsx';
import {getDefaultTitleSettings} from '../../utils/titleSettings.js';

afterEach(() => {cleanup(); vi.useRealTimers();});
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
