import React from 'react';
import OvalTableScene from './OvalTableScene.jsx';
import MobileTableSeat from './MobileTableSeat.jsx';
import '../../../styles/mobile-table.css';
import '../../../styles/oval-table.css';
export default function FriendTableScene({ state, viewerId, selected, onSelect, language, full = false }) {
  const ja = language === 'ja';
  const entries = state.playerStates.map((player,index) => ({ index, player, seat: { ...player, name:player.displayName, hand: player.id === viewerId ? state.hand : state.showdown?.hands?.[player.id] ?? Array.from({ length: player.cardCount ?? 4 }, () => 'AS'), showHand:Boolean(state.showdown?.hands?.[player.id]) } }));
  const hero = entries.find(e => e.player.id === viewerId);
  const others = entries.filter(e => e !== hero);
  const draw = state.phase.startsWith('draw');
  const renderSeat = (entry,isHero=false) => <MobileTableSeat seat={entry.seat} index={entry.index} hero={isHero} active={state.currentTurnPlayerId === entry.player.id} dealer={state.dealerSeat === entry.player.seat} position={entry.player.connected ? (ja ? '接続中' : 'Online') : (ja ? '接続未確認' : 'Connection unknown')} variant={state.variantId ?? 'badugi'} language={language} selection={isHero ? selected : []} canDraw={isHero && state.legalActions.includes('draw')} onCardClick={onSelect} cardTestPrefix={isHero ? 'p2p-card' : undefined} />;
  return <div className={`mgx-play--oval ${full ? "mgx-friend-scene-full" : "mgx-friend-scene"}`} data-phase-tone={draw ? 'draw' : 'bet'} data-testid="p2p-private-hand"><OvalTableScene others={others} hero={hero} renderSeat={renderSeat}><div className="mgx-community"><div data-testid="table-total-pot"><span>POT</span><strong>{state.pot}</strong></div><span className="mgx-community-phase">{draw ? (ja ? 'カード交換' : 'Draw') : state.phase === 'showdown' ? (ja ? 'ハンド終了' : 'Hand finished') : (ja ? 'ベット' : 'Betting')}</span></div></OvalTableScene></div>;
}
