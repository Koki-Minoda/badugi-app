import React from 'react';
import { getTablePhaseColors } from '../game/tablePhaseColors.js';
import MobileTableSeat from '../screens/layouts/MobileTableSeat.jsx';
import OvalTableScene from '../screens/layouts/OvalTableScene.jsx';
import '../../styles/mobile-table.css';
import '../../styles/oval-table.css';

export default function BadugiTrainingTable({
  players, heroSeat, actor, dealer, phase, phaseLabel, pot, potLabel, language,
  heroTestId, selection = [], onDrawSelect, children,
}) {
  const seats = players.map((seat, index) => ({ seat, index: seat.seat ?? index }));
  const heroIndex = seats.findIndex(({ index }) => index === heroSeat);
  const hero = seats[heroIndex];
  const others = hero ? [...seats.slice(heroIndex + 1), ...seats.slice(0, heroIndex)] : seats;
  const ja = language === 'ja';
  const renderSeat = ({ seat, index }, isHero = false) => (
    <MobileTableSeat
      seat={isHero || seat.showHand ? seat : { ...seat, hand: seat.hand?.map(() => null), holeCards: [] }} index={index} hero={isHero} active={index === actor} dealer={index === dealer}
      position={seat.position} variant="badugi" language={language}
      selection={isHero ? selection : []} canDraw={isHero && Boolean(onDrawSelect)} onCardClick={onDrawSelect}
      seatTestId={isHero ? heroTestId : undefined}
    />
  );

  return (
    <div className="mgx-play--oval rounded-2xl border border-white/15 p-2 md:p-3"
      data-phase-tone={getTablePhaseColors(phase).phaseTone}>
      <div className={`grid gap-3 ${children ? "md:grid-cols-[minmax(0,1fr)_240px]" : ""} [&_.mgx-table-scene]:min-h-[375px] portrait:[&_.mgx-seat-slot:not(.slot-hero)]:h-[100px] portrait:[&_.mgx-table-seat:not(.is-hero)_.mgx-seat-cards]:h-8 portrait:[&_.mgx-table-seat:not(.is-hero)_.mgx-seat-cards]:min-h-8`}>
        <OvalTableScene others={others} hero={hero} renderSeat={renderSeat}>
          <div className="mgx-community">
            <div data-testid="table-total-pot">
              <span aria-hidden={Boolean(potLabel)}>POT</span>
              {potLabel && <span className="sr-only">{potLabel} </span>}
              <strong>{pot == null ? (ja ? '記録なし' : 'Unavailable') : pot.toLocaleString()}</strong>
            </div>
            <div className="mgx-board-cards" />
            <span className="mgx-community-phase" data-testid="table-phase-badge">{phaseLabel}</span>
          </div>
        </OvalTableScene>
        {children}
      </div>
    </div>
  );
}
