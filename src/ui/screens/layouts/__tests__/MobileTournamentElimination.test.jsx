import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import MobileGameLayout from '../MobileGameLayout.jsx';
import {compactTournamentSeatViews,buildTournamentEliminatedRailEntries} from '../../../utils/tournamentSeatDisplay.js';
vi.mock('../../../learning/VariantRuleReminder.jsx',()=>({default:()=>null}));
vi.mock('../../../components/HandResultOverlay.jsx',()=>({default:()=>null}));
vi.mock('../../../components/HeroBustOverlay.jsx',()=>({default:()=>null}));
vi.mock('../../../components/TournamentResultOverlay.jsx',()=>({default:()=>null}));
afterEach(cleanup);
it('shows eliminated opponents in the mobile rail while retaining an unresolved all-in seat',()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const seats=[{name:'You',stack:500},{name:'Mina',stack:0,isBusted:true,tournamentPlayerId:'cpu-1',finishPlace:8},{name:'Ren',stack:0,allIn:true}];
 render(<MobileGameLayout headerProps={{language:'ja'}} sidePanelProps={{seatViews:seats,totalPot:100}} tableProps={{
  seatViews:compactTournamentSeatViews(seats,{isTournament:true}),isTournament:true,
  eliminatedRailEntries:buildTournamentEliminatedRailEntries(seats),boardCards:[],gameVariant:'nlh',seatLayouts:seats,
  positionNameFn:()=>'',heroDrawSelection:[],tableSummaryProps:{},
 }} controlsProps={{controlsPhase:'BET',heroCanAct:false}} overlaysProps={{}}/>);
 expect(screen.queryByTestId('seat-1')).toBeNull();
 expect(screen.getByTestId('seat-2').textContent).toContain('ALL IN');
 fireEvent.click(screen.getByRole('button',{name:/敗退/}));
 expect(screen.getByTestId('eliminated-rail-entry-cpu-1').textContent).toContain('Mina');
 expect(screen.getByTestId('eliminated-rail-entry-cpu-1').textContent).toContain('#8');
});
