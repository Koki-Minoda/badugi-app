import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MobileTableSeat from '../MobileTableSeat.jsx';
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('restores CPU portraits in both draw and board seats and preserves custom avatars',()=>{
 const {container,rerender}=render(<MobileTableSeat seat={{name:'Akira',isCPU:true,avatar:'default_avatar',stack:500}} index={1} variant="badugi"/>);
 expect(container.querySelector('.mgx-seat-avatar img').getAttribute('src')).toBe('/characters/akira.png');
 rerender(<MobileTableSeat seat={{name:'Ren',cpuCharacterId:'ren',stack:500}} index={1} variant="nlh"/>);
 expect(container.querySelector('.mgx-seat-avatar img').getAttribute('src')).toBe('/characters/ren.png');
 rerender(<MobileTableSeat seat={{name:'Ren',cpuCharacterId:'ren',avatarUrl:'/custom.png',stack:500}} index={1} variant="nlh"/>);
 expect(container.querySelector('.mgx-seat-avatar img').getAttribute('src')).toBe('/custom.png');
});
it('recovers from a failed portrait when the table merges and the seat occupant changes',()=>{
 const {container,rerender}=render(<MobileTableSeat seat={{name:'Akira',isCPU:true,stack:500}} index={1} variant="badugi"/>);
 fireEvent.error(container.querySelector('.mgx-seat-avatar img'));
 expect(container.querySelector('.mgx-seat-avatar svg')).toBeTruthy();
 rerender(<MobileTableSeat seat={{name:'Mina',isCPU:true,stack:900}} index={1} variant="badugi"/>);
 expect(container.querySelector('.mgx-seat-avatar img').getAttribute('src')).toBe('/characters/mina.png');
});
it('does not assign a CPU character to a friend with the same name',()=>{
 const {container}=render(<MobileTableSeat seat={{name:'Akira',stack:500}} index={1} variant="nlh"/>);
 expect(container.querySelector('.mgx-seat-avatar img')).toBeNull();
});
it('distinguishes a busted cash opponent from a folded player and a live all-in',()=>{
 const seat={name:'Mina',isCPU:true,stack:0,hand:['AS','KH'],allIn:true};
 const {rerender}=render(<MobileTableSeat seat={seat} index={1} variant="nlh"/>);
 expect(screen.getByTestId('seat-1').textContent).toContain('ALL IN');
 expect(screen.getAllByLabelText('伏せ札')).toHaveLength(2);
 rerender(<MobileTableSeat seat={{...seat,busted:true}} index={1} variant="nlh"/>);
 expect(screen.getByTestId('seat-1').textContent).toContain('離席');
 expect(screen.getByTestId('seat-1').textContent).not.toContain('フォールド');
 expect(screen.queryAllByLabelText('伏せ札')).toHaveLength(0);
});
it('keeps opponent down cards private while displaying Stud up cards',()=>{
 render(<MobileTableSeat seat={{name:'CPU',stack:500,hand:['AS','KH','2C'],cardVisibility:['down','down','up']}} index={1} variant="stud"/>);
 expect(screen.getAllByLabelText('伏せ札')).toHaveLength(2);expect(screen.queryByLabelText('A♠')).toBeNull();expect(screen.getByLabelText('2♣')).toBeTruthy();
});
it('preserves source indexes when sorted draw cards are selected',()=>{
 const onCardClick=vi.fn();render(<MobileTableSeat seat={{name:'You',stack:500,hand:['KC','2S','AH','4D']}} index={0} hero canDraw variant="badugi" selection={[0]} onCardClick={onCardClick}/>);
 fireEvent.click(screen.getByTestId('player-0-card-0'));expect(onCardClick).toHaveBeenCalledWith(0);expect(screen.getByTestId('player-0-card-0').getAttribute('aria-pressed')).toBe('true');
});
it('renders Board holeCards when the generic hand is empty',()=>{
 render(<MobileTableSeat seat={{name:'You',stack:500,hand:[],holeCards:['AS','KH']}} index={0} hero variant="nlh"/>);
 expect(screen.getByLabelText('A♠')).toBeTruthy();expect(screen.getByLabelText('K♥')).toBeTruthy();
});
it('omits blind and dealer positions in Stud while keeping them in Holdem',()=>{
 const {container,rerender}=render(<MobileTableSeat seat={{name:'CPU',stack:500,hand:['AS','KH','2C'],cardVisibility:['down','down','up']}} index={1} dealer position="SB" variant="stud"/>);
 expect(container.querySelector('.mgx-seat-position').textContent).toBe('');
 rerender(<MobileTableSeat seat={{name:'CPU',stack:500,hand:['AS','KH'],cardVisibility:['down','down']}} index={1} dealer position="BTN" variant="nlh"/>);
 expect(container.querySelector('.mgx-seat-position').textContent).toBe('D · BTN');
});

it('keeps the configured hero name visible on the shared table',()=>{
 render(<MobileTableSeat seat={{name:'Device Hero',stack:500,hand:['AS','KH']}} index={0} hero variant="nlh"/>);
 expect(screen.getByTestId('seat-0-name').textContent).toBe('Device Hero');
});

it('loads saved root-relative character portraits under a mounted development base',()=>{
 vi.stubEnv('BASE_URL','/dev/');
 const {container}=render(<MobileTableSeat seat={{name:'Hero',avatar:'/characters/hero.png',stack:500}} index={0} hero variant="nlh"/>);
 expect(container.querySelector('.mgx-seat-avatar img').getAttribute('src')).toBe('/dev/characters/hero.png');
});
