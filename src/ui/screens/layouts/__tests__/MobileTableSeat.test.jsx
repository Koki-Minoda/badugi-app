import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MobileTableSeat from '../MobileTableSeat.jsx';
afterEach(cleanup);
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
