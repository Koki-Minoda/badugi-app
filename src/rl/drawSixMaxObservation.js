// Opt-in mirror of the current Python six-max lowball observation. It is not
// interchangeable with the historical browser encoder or any unverified model.
export const DRAW_SIXMAX_SCHEMA = 'draw-sixmax-selfplay-20261024-v1';
const mean = (xs, fallback = 0) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;
const clamp = x => Math.max(0, Math.min(1, x));
const lowRank = (rank, family) => family === 'low-a5' && rank === 14 ? 1 : rank;

function features(hand, family) {
  const ranks = hand.map(c => lowRank(c[0], family));
  const counts = new Map(); ranks.forEach(r => counts.set(r, (counts.get(r) ?? 0) + 1));
  const unique = [...counts.keys()].sort((a, b) => a - b);
  const suits = new Set(hand.map(c => c[1]));
  const straight = unique.length === 5 && unique[4] - unique[0] === 4;
  const flush = suits.size === 1;
  const group = [...counts.values()].sort((a, b) => b - a).join(',');
  let category = ({ '4,1': 7, '3,2': 6, '3,1,1': 3, '2,2,1': 2, '2,1,1,1': 1 })[group] ?? 0;
  if (family === 'low-27') category = Math.max(category, straight && flush ? 8 : flush ? 5 : straight ? 4 : 0);
  const high = Math.max(...ranks), sum = ranks.reduce((a, b) => a + b, 0);
  const quality = Math.max(0, 1 - ((high - 5) / 9) * 0.55 - (sum / 70) * 0.25);
  return { category, high, sum, made: counts.size, duplicateRanks: hand.length - counts.size,
    duplicateSuits: hand.length - suits.size, straight, flush,
    strength: clamp(quality - Math.min(0.7, category * 0.09) + counts.size * 0.025) };
}

function lexCompare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// Preserve the Python recommendation's exact subset/tie ordering. Explicit
// draw actions are encoded separately in the mask, never replaced by this hint.
function suggestedDiscards(hand, family) {
  let best = null;
  for (let size = hand.length; size > 0; size--) {
    for (let bits = 1; bits < 1 << hand.length; bits++) {
      const indexes = hand.map((_, i) => i).filter(i => bits & (1 << i));
      if (indexes.length !== size) continue;
      const kept = indexes.map(i => hand[i]), f = features(kept, family);
      const safe = f.duplicateRanks === 0 && (family === 'low-a5' || size < 5 || (!f.flush && !f.straight));
      const score = [+safe, -f.high, -f.sum, ...indexes];
      if (!best || lexCompare(score, best.score) > 0) best = { score, indexes };
    }
    if (best?.score[0]) break;
  }
  const keep = new Set((best?.indexes ?? []).filter(i => family === 'low-27' ? hand[i][0] < 10 : lowRank(hand[i][0], family) <= 8));
  const f = features(hand, family);
  if (f.category === 0 && f.high <= (family === 'low-27' ? 7 : 5)) return [];
  return hand.map((_, i) => i).filter(i => !keep.has(i));
}

function number(x, name) {
  if (!Number.isFinite(x)) throw new TypeError(`Missing finite ${name}`);
}
function cards(value) {
  if (!Array.isArray(value) || value.some(c => !Array.isArray(c) || c.length !== 2
    || !Number.isInteger(c[0]) || c[0] < 2 || c[0] > 14
    || !Number.isInteger(c[1]) || c[1] < 0 || c[1] > 3)) throw new TypeError('Invalid lowball cards');
}

/** Explicit public snapshot; only actor hand/discards are private. Chip units
 * must match training (SB=1, BB=2). Histories cannot be silently invented.
 */
export function buildDrawSixMaxObservation(input) {
  if (input?.schemaVersion !== DRAW_SIXMAX_SCHEMA) throw new TypeError('Draw six-max schema required');
  const { players, seat, dealerSeat, family, phase, drawRound, maxDraws, pot, currentBet, raiseCount, playersYetToAct, actionMask } = input;
  if (!['low-27', 'low-a5'].includes(family)) throw new TypeError('Lowball family required');
  if (!Array.isArray(players) || players.length !== 6) throw new TypeError('Six seats required');
  if (![seat, dealerSeat].every(x => Number.isInteger(x) && x >= 0 && x < 6)) throw new TypeError('Invalid seat');
  if (![1, 3].includes(maxDraws) || !Number.isInteger(drawRound) || drawRound < 0 || drawRound > maxDraws || !['BET', 'DRAW'].includes(phase)) throw new TypeError('Invalid draw round/phase');
  for (const [key, value] of Object.entries({ pot, currentBet, raiseCount, playersYetToAct })) number(value, key);
  if (!Array.isArray(actionMask) || actionMask.length !== 11 || actionMask.some(x => x !== 0 && x !== 1)) throw new TypeError('Eleven action bits required');
  for (const p of players) {
    for (const key of ['stack', 'bet', 'lastDraw', 'totalDraws']) number(p[key], key);
    if (typeof p.folded !== 'boolean' || typeof p.openedCurrentRound !== 'boolean') throw new TypeError('Public flags required');
    if (!Array.isArray(p.drawHistory) || p.drawHistory.length !== 3) throw new TypeError('Draw history required');
    p.drawHistory.forEach(x => number(x, 'drawHistory'));
    if (!Array.isArray(p.betHistory) || p.betHistory.length !== 3 || p.betHistory.some(x => typeof x !== 'boolean')) throw new TypeError('Bet history required');
  }
  const p = players[seat]; cards(p.hand); cards(p.discarded);
  if (p.hand.length !== 5 || typeof p.raisedPredraw !== 'boolean') throw new TypeError('Actor hand/predraw flag required');
  const opponents = players.map((p, i) => ({ ...p, index: i })).filter(x => x.index !== seat && !x.folded);
  const avg = (key, fallback = 0) => mean(opponents.map(x => x[key]), fallback);
  const hist = [0, 1, 2].map(i => mean(opponents.map(x => x.drawHistory[i])));
  const oppBets = [0, 1, 2].map(i => opponents.some(x => x.betHistory[i]));
  const opened = opponents.some(x => x.openedCurrentRound);
  const last = avg('lastDraw'), stack = avg('stack', 100);
  const pos = index => ((index - dealerSeat - 1 + 6) % 6) / 5;
  const call = Math.max(0, currentBet - p.bet), f = features(p.hand, family);
  const discards = suggestedDiscards(p.hand, family);
  const kept = p.hand.filter((_, i) => !discards.includes(i));
  const keptFeatures = kept.length ? features(kept, family) : null;
  const targetStrength = keptFeatures ? keptFeatures.strength * Math.max(0.40, 1 - discards.length * 0.12) : 0;
  const a5 = family === 'low-a5', blocker = a5 ? 14 : 2;
  const premium = new Set(a5 ? [14, 2, 3, 4, 5] : [2, 3, 4, 5]);
  const v = new Array(96).fill(0);
  v[0] = drawRound / maxDraws; v[1] = +(phase === 'BET'); v[2] = +(phase === 'DRAW');
  v[3] = call > 0 ? call / Math.max(1, pot + call) : 0; v[4] = Math.min(pot, 100) / 100;
  v[5] = +(seat === dealerSeat); v[6] = +(phase === 'BET' && drawRound >= maxDraws); v[7] = last / 5;
  v[8] = 0.05; v[9] = 0.54; v[10] = 0.50; v[11] = 0.76; v[12] = (maxDraws - drawRound) / maxDraws;
  v[13] = hist[0] / 5; v[14] = hist[1] / 5;
  v[15] = f.made / 5; v[16] = f.high / 14; v[17] = f.sum / 70;
  v[18] = f.duplicateRanks / 4; v[19] = f.duplicateSuits / 4; v[20] = +f.straight; v[21] = +f.flush; v[22] = f.strength;
  v[23] = hist[2] / 5; v[24] = Math.min(1, avg('totalDraws') / 15); v[25] = currentBet / 20; v[26] = raiseCount / 4;
  v[27] = +(last === 0 && drawRound > 0); v[28] = +opened; v[29] = +oppBets[0]; v[30] = +oppBets[1];
  v[31] = targetStrength; v[32] = discards.length / 5; v[33] = opponents.length / 5; v[34] = pos(seat); v[35] = playersYetToAct / 5;
  v[36] = targetStrength; v[37] = keptFeatures ? keptFeatures.high / 14 : 1;
  v[38] = p.hand.filter(c => premium.has(c[0])).length / 5; v[39] = p.hand.filter(c => c[0] === blocker).length / 4;
  v[41] = +!a5; v[42] = +a5;
  const original = opponents.find(x => x.betHistory[0]); v[43] = original ? pos(original.index) : 0;
  v[44] = Math.max(0, (opponents.length - 1) / 5); v[45] = +opened;
  v[46] = p.stack / Math.max(1, 16 * Math.max(1, maxDraws - drawRound + +(phase === 'BET'))); v[47] = +(drawRound >= 2);
  actionMask.forEach((x, i) => { v[48 + i] = x; });
  v[59] = +p.raisedPredraw; v[60] = +p.betHistory[0]; v[61] = +p.betHistory[1];
  v[62] = +(!p.betHistory[0] && !oppBets[0] && drawRound >= 1); v[63] = +(!p.betHistory[1] && !oppBets[1] && drawRound >= 2); v[64] = +(playersYetToAct > 0);
  v[65] = p.drawHistory[0] / 5; v[66] = p.drawHistory[1] / 5;
  v[67] = (hist[0] - hist[1]) / 5; v[68] = (hist[1] - hist[2]) / 5; v[69] = (last - p.lastDraw) / 5;
  v[70] = p.discarded.filter(c => c[0] === blocker).length / 4;
  v[71] = Math.min(1, p.discarded.filter(c => premium.has(c[0])).length / (a5 ? 20 : 16));
  v[72] = 1 - last / 5; v[73] = hist.slice(0, drawRound).filter(x => x === 0).length / maxDraws;
  v[74] = stack / 100; v[75] = p.stack / 100; v[76] = Math.min(2, stack / Math.max(1, p.stack)) / 2;
  v[77] = p.stack / Math.max(1, p.stack + opponents.reduce((sum, x) => sum + x.stack, 0));
  v[80] = maxDraws / 3; v[81 + ((seat - dealerSeat - 1 + 6) % 6)] = 1;
  return v;
}
