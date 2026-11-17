import React from 'react';
import BadugiTrainingTable from '../coaching/BadugiTrainingTable.jsx';
import { getPositionNameForSeat } from '../utils/positionLabels.js';

export default function BadugiPracticeTablePreview({
  session, activeSeat, heroTurn, legal, selection, onSelect, onAction, error, toCall, betSize, language,
}) {
  const ja = language === 'ja';
  const snapshot = session.snapshot;
  const done = session.finished;
  const drawing = !done && snapshot.phase === 'DRAW';
  const dealer = snapshot.dealerIdx ?? 0;
  const players = snapshot.players.map((seat, index) => ({
    ...seat, name: index === 0 ? 'You' : `CPU ${index}`, showHand: session.options.showAll || done,
    position: getPositionNameForSeat(index, dealer, snapshot.players),
  }));
  const can = type => heroTurn && !error && legal.some(action => action.type === type);
  const centerAction = drawing ? 'DRAW' : can('CHECK') ? 'CHECK' : 'CALL';
  const raiseAction = can('BET') ? 'BET' : 'RAISE';
  const phase = done ? (ja ? 'ハンド終了' : 'Hand finished')
    : drawing ? (ja ? `交換 ${Math.max(1, snapshot.drawRound ?? 0)}/3` : `Draw ${Math.max(1, snapshot.drawRound ?? 0)}/3`)
    : (ja ? `ベット ${(snapshot.betRound ?? snapshot.drawRound ?? 0) + 1}` : `Betting ${(snapshot.betRound ?? snapshot.drawRound ?? 0) + 1}`);
  const turn = heroTurn
    ? (session.options.selfPlay ? (ja ? `席 ${activeSeat + 1} の番` : `Seat ${activeSeat + 1} to act`) : (ja ? 'あなたの番' : 'Your turn'))
    : (ja ? `CPU ${session.actor} の番` : `CPU ${session.actor} to act`);
  const centerLabel = drawing
    ? (selection.length ? (ja ? `${selection.length}枚交換` : `Draw ${selection.length}`) : (ja ? '交換しない' : 'Stand pat'))
    : centerAction === 'CHECK' ? (ja ? 'チェック' : 'Check') : (ja ? `コール ${toCall}` : `Call ${toCall}`);
  const pot = done ? snapshot.lastHandResult?.pot : snapshot.pot
    ?? snapshot.players.reduce((sum, player) => sum + (player.totalInvested ?? 0), 0);

  return (
    <div data-testid="badugi-practice-game-preview">
      <BadugiTrainingTable players={players} heroSeat={activeSeat} actor={done ? null : session.actor}
        dealer={dealer} phase={snapshot.phase} phaseLabel={phase} pot={pot} language={language}
        heroTestId="practice-hero-hand" selection={selection} onDrawSelect={drawing && can('DRAW') ? onSelect : undefined}>
        {!done && <aside className="mgx-play-actions md:self-center" aria-label={ja ? '対局操作' : 'Table actions'}>
          <div className="mgx-game-context"><span>{phase}</span><span>10/20</span></div>
          <p className={`mgx-turn-message ${heroTurn ? 'is-your-turn' : ''}`} role="status" data-testid="practice-turn">{turn}</p>
          <div className="mgx-action-space">
            <div className="mgx-action-setting"><div className="mgx-amount-launch mgx-setting-value">
              <span>{drawing ? (ja ? 'カード交換' : 'Draw cards') : (ja ? '固定ベット' : 'Fixed limit')}</span>
              <strong>{drawing ? (ja ? `${selection.length}枚を選択` : `${selection.length} selected`) : (ja ? `${betSize} チップ` : `${betSize} chips`)}</strong>
            </div></div>
            <div className="mgx-bet-actions touch-manipulation [&_button:disabled]:opacity-40">
              <button type="button" disabled={drawing || !can('FOLD')} onClick={() => onAction({ type: 'FOLD' })}>{ja ? 'フォールド' : 'Fold'}</button>
              <button type="button" className="mgx-primary" disabled={!can(centerAction)}
                onClick={() => onAction({ type: centerAction, ...(drawing ? { discardIndexes: selection } : {}) })}>{centerLabel}</button>
              <button type="button" className="mgx-raise" disabled={drawing || !can(raiseAction)} onClick={() => onAction({ type: raiseAction })}>
                {raiseAction === 'BET' ? (ja ? 'ベット' : 'Bet') : (ja ? 'レイズ' : 'Raise')}
              </button>
            </div>
          </div>
          <p className="mgx-action-note">{drawing && (ja ? '交換するカードをタップ' : 'Select cards to exchange')}</p>
        </aside>}
      </BadugiTrainingTable>
    </div>
  );
}
