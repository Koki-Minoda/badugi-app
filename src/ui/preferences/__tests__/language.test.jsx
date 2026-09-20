import React,{useState} from 'react';
import { render,screen,fireEvent,cleanup } from '@testing-library/react';
import { afterEach,it,expect } from 'vitest';
import LanguageSelect from '../LanguageSelect.jsx';
import { useLanguage } from '../language.js';
function View(){const language=useLanguage();const [amount,setAmount]=useState('120');return <><LanguageSelect/><input aria-label="Amount" value={amount} onChange={e=>setAmount(e.target.value)}/><p>{language==='ja'?'プレイ':'Play'}</p></>;}
afterEach(()=>{cleanup();localStorage.clear();});
it('changes every subscriber, preserves entered amounts and survives remount',()=>{render(<View/>);fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'360'}});fireEvent.change(screen.getByLabelText('言語 / Language'),{target:{value:'en'}});expect(screen.getByText('Play')).toBeTruthy();expect(screen.getByLabelText('Amount').value).toBe('360');cleanup();render(<View/>);expect(screen.getByLabelText('言語 / Language').value).toBe('en');});
