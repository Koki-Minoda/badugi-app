import React, { useState } from 'react';
import GameScreen from '../screens/GameScreen.jsx';
import { useDeviceProfile } from '../hooks/useDeviceProfile.js';
import { DRAW_CASH_SEAT_LAYOUTS } from '../game/layoutGroups.js';
import { getTablePhaseColors } from '../game/tablePhaseColors.js';
import { getPositionNameForSeat } from '../utils/positionLabels.js';

export default function BadugiTrainingTable({
  players, heroSeat, actor, dealer, phase, pot, smallBlind, bigBlind,
  drawRound, betRound, currentBet, raiseCount, raiseCap, raiseUnit,
  startingStack, language, selection = [], legal = [], onAction, onDrawSelect,
  exitLabel, onExit, onUndo, onPracticeResult, onRestart, handResult, error,
}) {
  const { isMobile } = useDeviceProfile();
  const [statusBoardOpen, setStatusBoardOpen] = useState(false);
  const ja = language === 'ja';
  const replay = !onAction;
  const heroCanAct = Boolean(onAction && actor === heroSeat && legal.length && !error);
  const heroCanDraw = heroCanAct && phase === 'DRAW';
  const gameTitle = ja ? (replay ? 'Badugi · リプレイ' : 'Badugi · 練習') : (replay ? 'Badugi · Replay' : 'Badugi · Practice');
  const statusMessage = error || (replay ? (ja ? 'あなたの操作前' : 'Before your action') : undefined);
  const seatViews = players.map((player, index) => player && ({
    ...player,
    seatIndex: index,
    hand: index === heroSeat || player.showHand ? player.hand : player.hand?.map(() => null),
    holeCards: [],
  }));
  const positionName = index => players[index]?.position ??
    (dealer == null ? '' : getPositionNameForSeat(index, dealer, players));
  const hero = seatViews[heroSeat];
  const actorPosition = positionName(actor);
  const actorName = seatViews[actor]?.name;
  const waitingLabel = statusMessage ?? (heroCanAct
    ? (ja ? `あなたの番 / ${positionName(heroSeat)}` : `Your action / ${positionName(heroSeat)}`)
    : (actorName ? (ja ? `操作待ち: ${actorName}` : `Waiting for ${actorName}`) : undefined));
  const raiseType = legal.some(action => action.type === 'BET') ? 'BET' : 'RAISE';
  const nextHandLabel = ja ? '同じ開始手札でもう一度' : 'Repeat this starting hand';

  return (
    <GameScreen
      layoutMode={isMobile ? 'mobile' : 'desktop'}
      headerProps={{
        gameTitle, language, exitLabel, onNavigateTitle: onExit,
        labels: { mainMenu: exitLabel, settings: ja ? '一手戻す' : 'Undo' },
        onNavigateSettings: onUndo,
        onNavigateHistory: handResult ? onPracticeResult : undefined,
      }}
      sidePanelProps={{
        show: true, statusBoardOpen, onToggleStatusBoard: () => setStatusBoardOpen(previous => !previous),
        seatViews, dealerIdx: dealer, heroIndex: heroSeat, turn: actor,
        seatConfig: [], seatTypeOptions: [],
        totalPot: pot ?? (ja ? '記録なし' : 'Unavailable'), seatLabels: players.map((_, index) => positionName(index)),
      }}
      tableProps={{
        ...getTablePhaseColors(phase), seatViews, seatLayouts: DRAW_CASH_SEAT_LAYOUTS,
        heroSeatIndex: heroSeat, controllerTurn: actor, controllerDealerIdx: dealer,
        positionNameFn: positionName, tablePhase: phase, phase, gameVariant: 'badugi',
        tableSummaryProps: {
          sbValue: smallBlind, bbValue: bigBlind, maxDraws: 3, phaseTag: phase,
          startingStack, drawRound, betRoundIndex: betRound, raiseCount, showRaiseCount: phase === 'BET',
          dealerName: players[dealer]?.name,
        },
        betRoundValue: betRound, drawRoundValue: drawRound, boardCards: [],
        heroDrawSelection: selection, heroCanDraw, handleCardClick: onDrawSelect,
      }}
      controlsProps={{
        controlsPhase: phase, controlsCurrentBet: currentBet, readOnly: replay,
        legalActions: legal.map(action => action.type === 'BET' ? 'RAISE' : action.type),
        heroPlayerForControls: hero, heroCanAct, heroCanDraw,
        actionPanelInfo: {
          toCall: currentBet == null ? null : Math.max(0, currentBet - (hero?.betThisRound ?? 0)),
          currentBet, raiseUnit, raiseCount, raiseCap, heroPosition: positionName(heroSeat),
          currentActorName: actorName, currentActorPosition: actorPosition,
          statusMessage, waitingLabel,
        },
        playerFold: () => onAction?.({ type: 'FOLD' }),
        playerCall: () => onAction?.({ type: 'CALL' }),
        playerCheck: () => onAction?.({ type: 'CHECK' }),
        playerRaise: () => onAction?.({ type: raiseType }),
        drawSelected: () => onAction?.({ type: 'DRAW', discardIndexes: selection }),
      }}
      overlaysProps={{
        mode: replay ? 'replay' : 'practice', handResultVisible: Boolean(handResult), handResultSummary: handResult,
        onNextHand: onRestart, nextHandLabel,
      }}
      debugProps={{}}
    />
  );
}
