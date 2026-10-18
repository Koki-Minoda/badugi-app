import React from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import SaveFailureNotice from '../SaveFailureNotice.jsx';
import {saveCriticalJson, clearSaveFailure} from '../../../storage/criticalSave.js';
const key = 'notice-test';
afterEach(() => {cleanup(); clearSaveFailure(key);});
it('explains a failed save, permits dismissal and reports a new failure after recovery', () => {
 const denied = {setItem: () => {throw new Error('blocked');}};
 act(() => {saveCriticalJson(key, {}, {storage: denied});});
 render(<SaveFailureNotice/>);
 expect(screen.getByRole('alert').textContent).toContain('直前の保存地点');
 fireEvent.click(screen.getByRole('button', {name:'閉じる'})); expect(screen.queryByRole('alert')).toBeNull();
 act(() => {saveCriticalJson(key, {}, {storage:{setItem:vi.fn()}});});
 act(() => {saveCriticalJson(key, {}, {storage:denied});});
 expect(screen.getByRole('alert')).toBeTruthy();
 act(() => {saveCriticalJson(key, {}, {storage:{setItem:vi.fn()}});});
 expect(screen.queryByRole('alert')).toBeNull();
});
