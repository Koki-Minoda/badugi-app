import React from 'react';
import { handEnd, reviewPot, reviewEventLabel } from './reviewDetails.js';

export default function SavedHandDetails({ hand, language }) {
  const ja = language === 'ja';
  const end = handEnd(hand);
  const seats = hand.seats ?? hand.playerSummaries ?? hand.players ?? [];
  const events = hand.events?.length ? hand.events : hand.actionLog ?? [];
  const finalStacks = end.finalStacks ?? [];
  const hero = seats.find(seat => seat.isHero) ?? seats.find(seat => (seat.seat ?? seat.seatIndex) === 0);
  const initialHand = hero?.initialHand ?? [];
  const finalHand = hero?.hand ?? hero?.finalHand ?? [];
  const board = hand.boardCards ?? hand.uiSummary?.boardCards ?? [];
  const renderCards = cards => cards.filter(card => typeof card === 'string' || typeof card === 'number').map((card, index) => <span key={index} className={`rounded-md bg-white px-2 py-2 font-bold ${/[HD]$/.test(String(card)) ? "text-red-700" : "text-slate-950"}`}>{String(card).replace(/S$/, '♠').replace(/H$/, '♥').replace(/D$/, '♦').replace(/C$/, '♣')}</span>);
  const winners = end.winners ?? hand.winners ?? hand.uiSummary?.winners ?? [];
  return <section className="space-y-4 text-sm" aria-label={ja ? '保存したハンドの内容' : 'Saved hand details'}>
    <div className="flex flex-wrap gap-4 rounded-xl bg-slate-950/50 p-3">
      <span>Pot: <b>{reviewPot(hand)}</b></span>
      <span>BTN: {hand.buttonSeat ?? '—'}</span>
      <span>{ja ? '勝者' : 'Winners'}: {winners.map(w => typeof w === 'object' ? `${w.name ?? `Seat ${w.seat ?? w.seatIndex ?? '—'}`} +${w.amount ?? w.payout ?? 0}` : String(w)).join(', ') || '—'}</span>
    </div>
    {(initialHand.length > 0 || finalHand.length > 0 || board.length > 0) && <div className="grid gap-4 sm:grid-cols-2">
      {initialHand.length > 0 && <div><h3 className="mb-2 font-semibold">{ja ? '自分の最初の手札' : 'Your starting hand'}</h3><div className="flex flex-wrap gap-2">{renderCards(initialHand)}</div></div>}
      {finalHand.length > 0 && <div><h3 className="mb-2 font-semibold">{ja ? '自分の最後の手札' : 'Your final hand'}</h3><div className="flex flex-wrap gap-2">{renderCards(finalHand)}</div></div>}
      {board.length > 0 && <div><h3 className="mb-2 font-semibold">{ja ? 'ボード' : 'Board'}</h3><div className="flex flex-wrap gap-2">{renderCards(board)}</div></div>}
    </div>}
    {seats.length > 0 && <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-xs"><thead className="bg-slate-800"><tr>
        <th className="p-2">Seat</th><th className="p-2">{ja ? 'プレイヤー' : 'Player'}</th><th className="p-2">{ja ? '持ち点（開始 → 終了）' : 'Stack (start → end)'}</th><th className="p-2">{ja ? '記録された役' : 'Recorded hand'}</th>
      </tr></thead><tbody>{seats.map((seat, index) => {
        const seatId = seat.seat ?? seat.seatIndex ?? index;
        return <tr key={seatId} className="border-t border-white/10"><td className="p-2">{seatId}</td><td className="p-2">{seat.name ?? `Seat ${seatId}`}</td><td className="p-2">{seat.initialStack ?? seat.startStack ?? seat.stackBefore ?? '—'} → {seat.stackAfter ?? seat.endStack ?? finalStacks.find(item => item.seat === seatId)?.stack ?? '—'}</td><td className="p-2">{seat.handLabel ?? seat.evaluation?.handName ?? seat.evaluation?.label ?? '—'}</td></tr>;
      })}</tbody></table>
    </div>}
    <div><h3 className="mb-2 font-semibold">{ja ? 'アクション記録' : 'Action history'}</h3>
      {events.length ? <ol className="max-h-80 space-y-2 overflow-y-auto rounded-xl bg-slate-950/50 p-3">{events.map((event, index) => <li key={index} className="break-words"><span className="mr-2 text-slate-400">{index + 1}.</span>{reviewEventLabel(event, language)}</li>)}</ol> : <p className="text-slate-400">{ja ? 'このハンドにはアクション記録がありません。' : 'No action history was recorded for this hand.'}</p>}
    </div>
  </section>;
}
