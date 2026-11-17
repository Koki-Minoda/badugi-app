import React from 'react';
import BadugiTrainingTable from '../coaching/BadugiTrainingTable.jsx';

export default function BadugiPracticeTablePreview({
  session, activeSeat, legal, selection, onSelect, onAction, error, betSize, language,
  onExit, onRestart, onPracticeResult, onUndo,
}) {
  const snapshot = session.snapshot;
  const done = session.finished;
  const players = snapshot.players.map((player, index) => ({
    ...player,
    name: index === 0 ? 'You' : `CPU ${index}`,
    showHand: session.options.showAll || done,
  }));
  const pot = snapshot.pot ?? players.reduce((sum, player) => sum + (player.totalInvested ?? 0), 0);
  const drawRound = snapshot.drawRound ?? 0;
  const betRound = snapshot.phase === 'DRAW' ? Math.max(0, drawRound - 1) : drawRound;

  return (
    <div data-testid="badugi-practice-game-preview">
      <BadugiTrainingTable players={players} heroSeat={activeSeat} actor={done ? null : session.actor}
        dealer={snapshot.dealerIdx ?? 0} phase={snapshot.phase} pot={done ? snapshot.lastHandResult?.pot : pot}
        smallBlind={10} bigBlind={20} betRound={betRound} drawRound={drawRound} startingStack={2000}
        currentBet={snapshot.currentBet} raiseUnit={betSize} raiseCount={snapshot.raiseCountThisRound}
        raiseCap={snapshot.raiseCap} language={language}
        selection={selection} legal={legal} onDrawSelect={onSelect} onAction={onAction} error={error}
        onExit={onExit} exitLabel={language === 'ja' ? '練習設定に戻る' : 'Back to practice setup'}
        onUndo={onUndo} onRestart={onRestart} onPracticeResult={onPracticeResult}
        handResult={done ? snapshot.lastHandResult : undefined} />
    </div>
  );
}
