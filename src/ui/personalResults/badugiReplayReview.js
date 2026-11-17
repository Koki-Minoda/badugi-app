import { STORAGE_KEYS } from '../../storage/keys.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';
import { evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';

const stock = new Set(PRACTICE_CARDS);

function normalizeCards(cards) {
  if (!Array.isArray(cards)) return null;
  const normalized = cards.map(card => typeof card === 'string' ? card.trim().toUpperCase().replace(/^T/, '10') : null);
  return normalized.length === 4 && new Set(normalized).size === 4 && normalized.every(card => stock.has(card)) ? normalized : null;
}

function drawDetail(history, event) {
  const actions = history.seats?.find(seat => (seat.seat ?? seat.seatIndex) === event.seat)?.actions;
  const action = event.actionSeq != null ? actions?.find(action => action.seq === event.actionSeq) : null;
  const detail = action?.metadata?.drawInfo ?? event.drawInfo;
  const round = event.drawRoundIndex ?? detail?.drawRoundIndex ?? action?.metadata?.drawRound;
  return { round, detail };
}

function recordedDraw(history, event) {
  const { round, detail } = drawDetail(history, event);
  const cards = normalizeCards(event.before ?? detail?.before);
  const indexes = (event.replacedCards ?? detail?.replacedCards)?.map(card => card.index)
    ?? detail?.discardIndexes ?? detail?.drawIndexes ?? event.discarded;
  const count = event.drawCount ?? detail?.drawCount ?? indexes?.length;
  const validIndexes = count === 0 ? [] : Array.isArray(indexes) && indexes.length === count && new Set(indexes).size === indexes.length
    && indexes.every(index => Number.isInteger(index) && index >= 0 && index < 4) ? indexes : null;
  return { cards, round, count, discards: cards && validIndexes?.map(index => cards[index]) };
}

export function badugiReplaySpot(history, frames, index) {
  if (!['badugi', 'd03'].includes(String(history?.variantId ?? history?.variant).toLowerCase()) || !history.handId) return null;
  const tagged = history.seats?.find(seat => seat.isHero || seat.hero);
  const heroSeat = tagged?.seat ?? tagged?.seatIndex ?? history.heroSeat ?? history.heroSeatIndex;
  const event = frames[index]?.event;
  const previous = frames[index - 1];
  if (heroSeat == null || event?.type !== 'DRAW_ACTION' || event.seat !== heroSeat || !previous) return null;
  const draw = recordedDraw(history, event);
  if (![1, 2, 3].includes(draw.round) || !draw.cards) return null;
  const active = previous.players.filter(player => !player.folded);
  const hero = active.find(player => player.seat === heroSeat);
  const opponent = active.find(player => player.seat !== heroSeat);
  if (active.length !== 2 || !hero || !opponent) return null;

  let observedCount = null;
  const priorDiscards = new Set();
  const drawHistory = [];
  for (const { event: prior } of frames.slice(0, index)) {
    if (prior?.type !== 'DRAW_ACTION') continue;
    if (prior.seat === heroSeat) {
      const own = recordedDraw(history, prior);
      for (const card of own.discards ?? []) if (!draw.cards.includes(card)) priorDiscards.add(card);
      if ([1, 2, 3].includes(own.round) && [0, 1, 2, 3, 4].includes(own.count)) {
        drawHistory.push({ round: own.round, player: 'hero', count: own.count });
      }
    } else if (prior.seat === opponent.seat) {
      const { round, detail } = drawDetail(history, prior);
      const count = prior.drawCount ?? detail?.drawCount;
      if ([1, 2, 3].includes(round) && [0, 1, 2, 3, 4].includes(count)) {
        drawHistory.push({ round, player: 'opponent', count });
        if (round === draw.round) observedCount = count;
      }
    }
  }
  return {
    handId: history.handId,
    actionSeq: Number.isInteger(event.actionSeq) ? event.actionSeq : null,
    remainingDraws: 4 - draw.round,
    cards: draw.cards,
    actualDiscards: draw.discards ?? null,
    observedCount,
    drawHistory,
    deadCards: [...priorDiscards],
    pot: previous.pot,
    effectiveStack: Math.min(hero.stack, opponent.stack),
    ...(Number.isFinite(history.endedAt) ? { endedAt: history.endedAt } : {}),
  };
}

export function isSecondDrawReviewSpot(spot) {
  return spot?.remainingDraws === 2 && spot.actionSeq != null && Number.isFinite(spot.endedAt) && spot.effectiveStack > 0
    && spot.observedCount != null && Array.isArray(spot.actualDiscards) && spot.actualDiscards.length <= 1
    && evaluateBadugi(spot.cards).count === 4;
}

export function getReviewUserId() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH))?.user?.id ?? null; } catch { return null; }
}

function reviewKey(userId) {
  return `mgx.badugiReplayReviews.v1:${userId}`;
}

export function readBadugiReviews(userId) {
  if (userId == null) return [];
  try {
    const entries = JSON.parse(localStorage.getItem(reviewKey(userId)));
    return Array.isArray(entries) ? entries.filter(entry => Number.isFinite(entry?.loss) && Number.isFinite(entry.bet) && entry.bet > 0 && Array.isArray(entry.cards) && Array.isArray(entry.best)) : [];
  } catch { return []; }
}

export function saveBadugiReview(userId, spot, settings, actions, assumptions) {
  if (userId == null || spot.actionSeq == null || !Array.isArray(spot.actualDiscards)) return false;
  const actual = actions.find(({ cards }) => cards.length === spot.actualDiscards.length && cards.every(card => spot.actualDiscards.includes(card)));
  if (!actual || !actions.every(action => Number.isFinite(action.ev))) return false;
  const best = actions.reduce((winner, action) => action.ev > winner.ev ? action : winner, actions[0]);
  const entry = {
    handId: spot.handId, actionSeq: spot.actionSeq, cards: actual.cards, best: best.cards,
    at: Date.now(), loss: best.ev - actual.ev, bet: settings.bet, settings,
    remainingDraws: spot.remainingDraws, endedAt: spot.endedAt,
    samplingMargin: actual === best ? 0 : 1.96 * ((actual.evSE ?? 0) + (best.evSE ?? 0)),
    ...assumptions,
  };
  const existing = readBadugiReviews(userId).filter(review => review.handId !== entry.handId || review.actionSeq !== entry.actionSeq);
  try {
    localStorage.setItem(reviewKey(userId), JSON.stringify([entry, ...existing].slice(0, 100)));
    return true;
  } catch { return false; }
}
