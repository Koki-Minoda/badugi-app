import React from 'react';
// Shared positioning and felt for CPU and friend tables.
export default function OvalTableScene({ others, hero, renderSeat, children }) {
  const slots = {1:['top-center'],2:['top-left','top-right'],3:['left','top-center','right'],4:['left','top-left','top-right','right']}[others.length] ?? ['left','top-left','top-center','top-right','right'];
  return <div className="mgx-table-scene" data-testid="game-table-surface"><div className="mgx-table-felt" data-testid="table-felt" aria-hidden="true" />{others.map((entry,i) => <div className={`mgx-seat-slot slot-${slots[i]}`} key={entry.index}>{renderSeat(entry)}</div>)}{children}{hero && <div className="mgx-seat-slot slot-hero">{renderSeat(hero,true)}</div>}</div>;
}
