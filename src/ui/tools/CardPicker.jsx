import React, { useState } from 'react';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';
import { cardText } from './cardText.js';

const suits = [
  ['S', 'スペード', 'Spades'],
  ['H', 'ハート', 'Hearts'],
  ['D', 'ダイヤ', 'Diamonds'],
  ['C', 'クラブ', 'Clubs'],
];

export default function CardPicker({ cards, count, onChange, blocked = [], label, ja, bySuit = false, children }) {
  const [suit, setSuit] = useState('S');
  const visible = bySuit ? PRACTICE_CARDS.filter(card => card.endsWith(suit)) : PRACTICE_CARDS;
  const remove = card => onChange(cards.filter(value => value !== card));
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-white/20 p-3">
      <legend className="px-2 font-bold">{label} · {cards.length}{count !== undefined && `/${count}`}</legend>
      <div className={`flex flex-wrap gap-2 ${count !== undefined ? 'min-h-12' : ''}`}>
        {cards.map(card => (
          <button type="button" key={card} onClick={() => remove(card)} aria-label={`${ja ? '外す' : 'Remove'} ${cardText(card)}`} className={`min-h-11 rounded bg-white font-bold ${bySuit ? 'min-w-11 px-2' : 'px-3'} ${/[HD]$/.test(card) ? 'text-red-700' : 'text-slate-950'}`}>
            {cardText(card)}
          </button>
        ))}
        {bySuit && count !== undefined && Array.from({ length: count - cards.length }, (_, index) => (
          <span key={index} aria-hidden="true" className="h-11 w-11 rounded border border-dashed border-slate-500" />
        ))}
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? 'カードを選ぶ' : 'Choose cards'}</summary>
        {bySuit && (
          <div role="group" aria-label={ja ? 'スート' : 'Suit'} className="mb-2 grid grid-cols-4 gap-2">
            {suits.map(([id, jp, en]) => (
              <button key={id} type="button" aria-pressed={id === suit} aria-label={ja ? jp : en} onClick={() => setSuit(id)} className={`min-h-11 rounded border text-lg ${id === suit ? 'border-white bg-white/20' : 'border-white/25'} ${/[HD]/.test(id) ? 'text-red-300' : 'text-white'}`}>
                {cardText(id)}
              </button>
            ))}
          </div>
        )}
        <div className={`grid grid-cols-7 gap-1 ${bySuit ? '' : 'sm:grid-cols-[repeat(13,minmax(0,1fr))]'}`}>
          {visible.map(card => {
            const selected = cards.includes(card);
            return (
              <button type="button" key={card} aria-pressed={selected} disabled={blocked.includes(card) || (!selected && count !== undefined && cards.length >= count)} onClick={() => selected ? remove(card) : onChange([...cards, card])} className={`min-h-11 rounded border px-1 text-sm font-semibold disabled:opacity-25 ${selected ? 'border-emerald-300 bg-emerald-300 text-slate-950' : /[HD]$/.test(card) ? 'border-white/20 text-red-300' : 'border-white/20 text-white'}`}>
                {cardText(card)}
              </button>
            );
          })}
        </div>
      </details>
      {(!bySuit || (count === undefined && cards.length > 0)) && <button type="button" className="min-h-11 text-sm underline" onClick={() => onChange([])}>{ja ? '選び直す' : 'Clear'}</button>}
      {children}
    </fieldset>
  );
}
