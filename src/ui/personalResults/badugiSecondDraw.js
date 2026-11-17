import { replayHandFromHistory } from '../../games/badugi/flow/handReplay.js';
import { badugiReplaySpot, isSecondDrawReviewSpot } from './badugiReplayReview.js';

const strong = '8to9';
const wide = 'QtoK';
const spot = (opponentCount, range, rangeText) => ({ opponentCount, range, rangeText });
const sharedWeak = '2C 4H 8D QS 2\n4C 6D 8H KS 1';
const practice = [
  { id: 'draw-count', hero: ['AS', '3H', '5D', '10C'], spots: [
    spot(0, strong, '2S 4H 6D 8C 2\n3S 4D 2C 9H 1'),
    spot(1, strong, '2S 4H 6D 8C 2\n3S 4D 2C 9H 1'),
  ] },
  { id: 'range-shift', hero: ['2S', '4H', '6D', '10C'], spots: [
    spot(0, wide, '2C 5H 8D QS 2\n4C 7D 8H KS 1'),
    spot(0, strong, 'AS 3H 5D 8C 2\n3S 4D 2C 9H 1'),
  ] },
  { id: 'stable', hero: ['3S', '5H', '7C', '10D'], spots: [spot(0, wide, sharedWeak), spot(1, wide, sharedWeak)] },
];

const holdoutWeak = '3C 4H 8D QS 2\n4C 6D 8H KS 1';
const retest = [
  { id: 'unseen-stable', hero: ['2C', '3S', '6H', '10D'], spots: [spot(1, wide, holdoutWeak), spot(0, wide, holdoutWeak)] },
  { id: 'unseen-count', hero: ['AS', '2D', '4C', '10H'], spots: [
    spot(1, strong, '2S 3H 5D 8C 2\n3S 4D 2C 9H 1'),
    spot(0, strong, '2S 3H 5D 8C 2\n3S 4D 2C 9H 1'),
  ] },
  { id: 'unseen-range', hero: ['AS', '2H', '4D', '10C'], spots: [
    spot(0, strong, '2S 4H 6D 8C 2\n3S 5D 2C 9H 1'),
    spot(0, wide, sharedWeak),
  ] },
];

export const SECOND_DRAW_SETTINGS = { pot: 30, middleBet: 0, bet: 10, lead: 10, call: 12, heroCall: 11, heroBet: 10 };
const MAX_REVIEW_SPOTS = 20;
const MIN_EV_GAP_IN_BETS = 0.05;

export function secondDrawPairs(mode) {
  return mode === 'retest' ? retest : practice;
}

export function secondDrawPairRequest(pair) {
  return {
    pair: pair.spots.map(({ opponentCount, rangeText }) => ({
      hands: [pair.hero, []], remainingDraws: 2, settings: SECOND_DRAW_SETTINGS, opponentCount, rangeText,
    })),
  };
}

export function reviewHasClearGap(loss, bet, samplingMargin) {
  return loss > Math.max(samplingMargin, MIN_EV_GAP_IN_BETS * bet);
}

export function assessSecondDrawPair(results, answers) {
  return results.map(({ actions }, index) => {
    const chosen = actions.find(action => (action.cards[0] ?? 'pat') === answers[index].move);
    const best = actions.reduce((leader, action) => action.ev > leader.ev ? action : leader);
    const pat = actions.find(action => action.cards.length === 0);
    const redraw = actions.filter(action => action.cards.length === 1)
      .reduce((leader, action) => action.ev > leader.ev ? action : leader);
    const loss = best.ev - chosen.ev;
    const margin = 1.96 * (best.evSE + chosen.evSE);
    return {
      chosen, best, pat, redraw, loss, close: !reviewHasClearGap(loss, SECOND_DRAW_SETTINGS.bet, margin),
      read: answers[index].read, reason: answers[index].reason,
    };
  });
}

export function summarizeSecondDrawPractice(pairs) {
  const moves = pairs.flat();
  return {
    pairs: pairs.length,
    closePairs: pairs.filter(pair => pair.every(move => move.close)).length,
    closeMoves: moves.filter(move => move.close).length,
    moves: moves.length,
    meanLoss: moves.reduce((sum, move) => sum + move.loss / SECOND_DRAW_SETTINGS.bet, 0) / moves.length,
  };
}

function progressKey(userId) {
  return `mgx.badugiSecondDraw.v1:${userId}`;
}

export function readSecondDrawProgress(userId) {
  if (userId == null) return {};
  try { return JSON.parse(localStorage.getItem(progressKey(userId))) ?? {}; } catch { return {}; }
}

export function saveSecondDrawProgress(userId, progress) {
  if (userId == null) return false;
  try { localStorage.setItem(progressKey(userId), JSON.stringify(progress)); return true; } catch { return false; }
}

function liveSpots(hands, userId) {
  const seen = new Set();
  const spots = [];
  for (const hand of hands) {
    if (!hand?.handId || !Number.isFinite(hand.endedAt) || hand.guestTrial || hand.historySource === 'guest'
      || !['badugi', 'd03'].includes(String(hand.variantId ?? hand.variant).toLowerCase())
      || (hand.userId != null && String(hand.userId) !== String(userId)) || seen.has(hand.handId)) continue;
    seen.add(hand.handId);
    const hero = hand.seats?.find(seat => seat.isHero || seat.hero);
    const heroSeat = hero?.seat ?? hero?.seatIndex ?? hand.heroSeat ?? hand.heroSeatIndex;
    const ownDraw = hand.events?.some(event => event?.type === 'DRAW_ACTION' && event.seat === heroSeat
      && (event.drawRoundIndex == null || event.drawRoundIndex === 2));
    if (!ownDraw) continue;
    const frames = replayHandFromHistory(hand);
    for (const [index, { event }] of frames.entries()) {
      if (event?.type !== 'DRAW_ACTION' || event.seat !== heroSeat || (event.drawRoundIndex != null && event.drawRoundIndex !== 2)) continue;
      const spot = badugiReplaySpot(hand, frames, index);
      if (isSecondDrawReviewSpot(spot)) spots.push(spot);
    }
  }
  return spots.sort((a, b) => a.endedAt - b.endedAt);
}

function spotKey(spot) {
  return `${spot.handId}:${spot.actionSeq}`;
}

export function measureSecondDrawTransfer(hands, reviews, practice, userId) {
  const spots = liveSpots(hands, userId);
  const bySpot = new Map(reviews.filter(entry => entry.remainingDraws === 2)
    .map(entry => [spotKey(entry), entry]));
  const before = spots.filter(spot => spot.endedAt < practice.startedAt).slice(-MAX_REVIEW_SPOTS);
  const after = spots.filter(spot => spot.endedAt > practice.finishedAt).slice(0, MAX_REVIEW_SPOTS);
  const summary = cohort => {
    const graded = cohort.map(spot => bySpot.get(spotKey(spot))).filter(Boolean);
    return {
      opportunities: cohort.length,
      reviewed: graded.length,
      gaps: graded.filter(entry => reviewHasClearGap(entry.loss, entry.bet, entry.samplingMargin ?? 0)).length,
    };
  };
  return {
    before: summary(before),
    after: summary(after),
    next: after.find(spot => !bySpot.has(spotKey(spot))) ?? before.findLast(spot => !bySpot.has(spotKey(spot))),
  };
}
