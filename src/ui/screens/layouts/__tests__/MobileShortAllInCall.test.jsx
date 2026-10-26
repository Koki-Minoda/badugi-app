import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import MobileGameLayout from '../MobileGameLayout.jsx';

vi.mock('../../../learning/VariantRuleReminder.jsx',()=>({default:()=>null}));
vi.mock('../../../components/HandResultOverlay.jsx',()=>({default:()=>null}));
vi.mock('../../../components/HeroBustOverlay.jsx',()=>({default:()=>null}));
vi.mock('../../../components/TournamentResultOverlay.jsx',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});

function renderCall({stack}) {
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  const playerCall=vi.fn();
  const seats=[{name:'You',stack,betThisRound:0},{name:'Mina',stack:500,betThisRound:100}];
  render(<MobileGameLayout
    headerProps={{language:'ja',gameTitle:'NLH'}}
    sidePanelProps={{seatViews:seats,heroIndex:0,totalPot:100}}
    tableProps={{
      seatViews:seats,heroSeatIndex:0,boardCards:[],gameVariant:'nlh',seatLayouts:seats,
      positionNameFn:()=>'',heroDrawSelection:[],tableSummaryProps:{sbValue:10,bbValue:20},
    }}
    controlsProps={{
      controlsPhase:'BET',heroCanAct:true,heroPlayerForControls:seats[0],controlsCurrentBet:100,
      actionPanelInfo:{toCall:100,raiseUnit:20},betSizingModel:{enabled:true,minCommit:120,maxCommit:stack},
      playerCall,playerCheck:vi.fn(),playerFold:vi.fn(),playerRaise:vi.fn(),
    }}
    overlaysProps={{}}
  />);
  return playerCall;
}

it.each([64,100])('shows the payable all-in call of %i without an impossible raise',stack=>{
  const playerCall=renderCall({stack});
  expect(screen.getByTestId('player-action-hint').textContent).toContain(`コール ${stack}`);
  expect(screen.getByTestId('action-call').textContent).toBe(`オールイン ${stack}`);
  expect(screen.getByTestId('action-call').className).toContain('mgx-primary--wide');
  expect(screen.queryByTestId('action-raise')).toBeNull();
  expect(screen.queryByTestId('bet-size-input')).toBeNull();
  expect(screen.getByTestId('action-setting-slot').textContent).toContain(`${stack} チップ`);
  fireEvent.click(screen.getByTestId('action-call'));
  expect(playerCall).toHaveBeenCalledTimes(1);
});

it('keeps the full call amount and raise controls when the stack covers the call',()=>{
  renderCall({stack:160});
  expect(screen.getByTestId('player-action-hint').textContent).toContain('コール 100');
  expect(screen.getByTestId('action-call').textContent).toBe('コール 100');
  expect(screen.getByTestId('action-raise')).toBeTruthy();
  expect(screen.getByTestId('bet-size-input')).toBeTruthy();
});
