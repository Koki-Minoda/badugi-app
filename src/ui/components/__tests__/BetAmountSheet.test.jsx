import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import BetAmountSheet from '../BetAmountSheet.jsx';
afterEach(cleanup);
const model={minCommit:40,maxCommit:500,actionType:'raise',presets:[{key:'min',label:'Min',amount:40},{key:'all-in',label:'All-in',amount:500}]};
describe('touch amount entry',()=>{
 it('replaces the initial amount and commits only the confirmed amount',()=>{
  const onConfirm=vi.fn();render(<BetAmountSheet model={model} onConfirm={onConfirm} onClose={()=>{}}/>);
  fireEvent.click(screen.getByTestId('bet-key-8'));fireEvent.click(screen.getByTestId('bet-key-0'));
  expect(screen.getByTestId('bet-amount-value').textContent).toBe('80');expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('bet-amount-confirm'));expect(onConfirm).toHaveBeenCalledWith(80);
 });
 it('does not silently clamp invalid input or submit it',()=>{
  const onConfirm=vi.fn();render(<BetAmountSheet model={model} onConfirm={onConfirm} onClose={()=>{}}/>);
  fireEvent.click(screen.getByTestId('bet-key-8'));expect(screen.getByTestId('bet-amount-confirm').disabled).toBe(true);
  fireEvent.click(screen.getByTestId('bet-key-0'));fireEvent.click(screen.getByTestId('bet-key-0'));
  expect(screen.getByTestId('bet-amount-value').textContent).toBe('800');expect(screen.getByTestId('bet-amount-confirm').disabled).toBe(true);
  fireEvent.click(screen.getByTestId('bet-amount-confirm'));expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('bet-key-back'));expect(screen.getByTestId('bet-amount-confirm').disabled).toBe(false);
  fireEvent.click(screen.getByTestId('bet-key-clear'));expect(screen.getByTestId('bet-amount-confirm').disabled).toBe(true);
 });
 it('cancels without a betting action and allows replacing a preset',()=>{
  const onConfirm=vi.fn(),onClose=vi.fn();render(<BetAmountSheet model={model} onConfirm={onConfirm} onClose={onClose}/>);
  fireEvent.click(screen.getByTestId('bet-preset-all-in'));fireEvent.click(screen.getByTestId('bet-key-8'));fireEvent.click(screen.getByTestId('bet-key-0'));
  expect(screen.getByTestId('bet-amount-value').textContent).toBe('80');fireEvent.click(screen.getByTestId('bet-amount-cancel'));expect(onClose).toHaveBeenCalled();expect(onConfirm).not.toHaveBeenCalled();
 });
});
