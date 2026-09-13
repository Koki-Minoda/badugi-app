const scalar = value => ['string', 'number'].includes(typeof value) ? String(value) : '';
export function handEnd(hand) {
  return [...(hand.events ?? [])].reverse().find(event => event?.type === 'HAND_END') ?? {};
}
export function reviewPot(hand) { return handEnd(hand).totalPot ?? hand.pot ?? hand.uiSummary?.pot ?? '—'; }

const labels = {
  HAND_START: ['ハンド開始', 'Hand start'], HAND_END: ['ハンド終了', 'Hand end'],
  SHOWDOWN: ['ショーダウン', 'Showdown'], ANTE_POSTED: ['アンティ', 'Ante'],
  BET_ACTION: ['ベット', 'Bet'], DRAW_ACTION: ['カード交換', 'Draw'], ACTION: ['アクション', 'Action'],
  IDLE: ['開始前', 'Before hand'], BET: ['ベット', 'Betting'], DRAW: ['カード交換', 'Draw'],
  fold: ['フォールド', 'Fold'], call: ['コール', 'Call'], check: ['チェック', 'Check'],
  raise: ['レイズ', 'Raise'], bet: ['ベット', 'Bet'], draw: ['カード交換', 'Draw'],
};
export function reviewEventLabel(event, language = 'ja') {
  if (!event) return '—';
  const label = value => labels[value]?.[language === 'ja' ? 0 : 1] ?? scalar(value);
  if (event.type === 'BLINDS_POSTED') return `SB Seat ${event.sbSeat ?? '—'}: ${event.sbAmount ?? '—'} · BB Seat ${event.bbSeat ?? '—'}: ${event.bbAmount ?? '—'}`;
  if (event.type === 'HAND_END') return `${label(event.type)} · Pot ${event.totalPot ?? '—'}`;
  if (event.type === 'PHASE_TRANSITION') return `${label(event.from) || '—'} → ${label(event.to) || '—'}`;
  const seat = event.seat ?? event.seatIndex ?? event.actorSeat;
  const action = scalar(event.action ?? event.actionType ?? event.decision);
  const amount = event.amount ?? event.bet;
  const drawCount = event.drawCount ?? event.discarded?.length ?? event.cards?.length;
  return [label(event.street ?? event.phase), seat != null ? `Seat ${seat}` : '', label(action || event.type),
    amount != null ? String(amount) : '', event.type === 'DRAW_ACTION' && drawCount != null ? `${drawCount}${language === 'ja' ? '枚' : ' cards'}` : ''].filter(Boolean).join(' · ');
}
