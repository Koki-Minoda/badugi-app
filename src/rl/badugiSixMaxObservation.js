import { evaluateBadugi } from '../games/badugi/utils/badugiEvaluator.js';

// Explicit opt-in contract for the current Python six-max environment. This is
// not the historical browser v1 encoder and does not identify old model inputs.
export const BADUGI_SIXMAX_SCHEMA = 'badugi-sixmax-selfplay-20261024-v1';
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const mean = (xs, fallback = 0) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;

function requireNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`Missing finite ${name}`);
}

function requireCards(cards, name) {
  if (!Array.isArray(cards) || cards.some(card => !Array.isArray(card) || card.length !== 2
    || !Number.isInteger(card[0]) || card[0] < 0 || card[0] > 12
    || !Number.isInteger(card[1]) || card[1] < 0 || card[1] > 3)) {
    throw new TypeError(`Invalid zero-based ${name}`);
  }
}

/** Encode an explicit public snapshot plus the acting player's private cards.
 * Opponent hands, discards, deck, and future actions are never read.
 * Amounts must already use the training environment's chip units (SB=1, BB=2).
 * Missing histories fail closed; they must not silently become invented zeros.
 */
export function buildBadugiSixMaxObservation(input) {
  if (input?.schemaVersion !== BADUGI_SIXMAX_SCHEMA) throw new TypeError('Badugi six-max schema required');
  const { players, seat, dealerSeat, phase, drawRound, pot, currentBet, raiseCount, firstToAct, actionMask } = input;
  if (!Array.isArray(players) || players.length !== 6) throw new TypeError('Six seats required');
  if (![seat, dealerSeat].every(x => Number.isInteger(x) && x >= 0 && x < 6)) throw new TypeError('Invalid seat');
  if (!['BET', 'DRAW'].includes(phase) || !Number.isInteger(drawRound) || drawRound < 0 || drawRound > 3) throw new TypeError('Invalid phase/round');
  for (const [name, value] of Object.entries({ pot, currentBet, raiseCount })) requireNumber(value, name);
  if (typeof firstToAct !== 'boolean') throw new TypeError('firstToAct required');
  if (!Array.isArray(actionMask) || actionMask.length !== 6 || actionMask.some(x => x !== 0 && x !== 1)) throw new TypeError('Six legal-action bits required');
  for (const player of players) {
    for (const name of ['stack', 'bet', 'lastDraw']) requireNumber(player[name], name);
    if (typeof player.folded !== 'boolean' || typeof player.openedCurrentRound !== 'boolean') throw new TypeError('Public player flags required');
    if (!Array.isArray(player.drawHistory) || player.drawHistory.length !== 3) throw new TypeError('Three draw-history entries required');
    player.drawHistory.forEach(x => requireNumber(x, 'drawHistory'));
  }
  const p = players[seat];
  requireCards(p.hand, 'hand'); requireCards(p.discarded, 'discarded');
  if (p.hand.length !== 4) throw new TypeError('Four actor cards required');
  if (!Array.isArray(p.betHistory) || p.betHistory.length !== 3 || p.betHistory.some(x => typeof x !== 'boolean')) throw new TypeError('Actor betting history required');
  const opponents = players.filter((x, i) => i !== seat && !x.folded);
  const n = opponents.length;
  const avg = (key, fallback = 0) => mean(opponents.map(x => x[key]), fallback);
  const hist = i => mean(opponents.map(x => x.drawHistory[i]));
  const stack = avg('stack', 100), bet = avg('bet'), last = avg('lastDraw');
  const aggression = opponents.filter(x => x.openedCurrentRound).length / Math.max(1, n);
  const pat = opponents.filter(x => x.lastDraw === 0 && drawRound > 0).length / Math.max(1, n);
  const position = ((seat - dealerSeat - 1 + 6) % 6) / 5;
  const button = seat === dealerSeat, remaining = 3 - drawRound;
  const current = phase === 'BET' ? currentBet : 0;
  const call = Math.max(0, current - p.bet), odds = call > 0 ? call / Math.max(1, pot + call) : 0;
  const final = phase === 'BET' && drawRound >= 3;
  const f = evaluateBadugi(p.hand.map(([rank, suit]) => ({ rank: rank + 1, suit: 'CDHS'[suit] })));
  const count = f.count, high = f.ranks.length ? Math.max(...f.ranks) : 13;
  const sum = f.ranks.length ? f.ranks.reduce((a, b) => a + b, 0) : 99;
  const nuts = count === 4 && [...f.ranks].sort((a, b) => a - b).join(',') === '0,1,2,3';
  const strength = count === 4 ? 0.55 + Math.max(0, (13 - high) / 13) * 0.35 + (nuts ? 0.1 : 0)
    : count === 3 ? 0.30 + Math.max(0, (13 - high) / 13) * 0.20
      : count === 2 ? 0.12 + Math.max(0, (13 - high) / 13) * 0.08 : 0.05;
  const low = Math.max(0, (13 - (high || 13)) / 12);
  const street = count === 4 ? Math.min(1, 0.54 + low * 0.34 + 0.18 * remaining / 3)
    : count === 3 ? Math.min(0.72, 0.30 + low * 0.22 + 0.08 * remaining)
      : count === 2 ? Math.min(0.34, 0.12 + low * 0.10 + 0.04 * remaining) : 0.05;
  const range = count >= 4 ? Math.min(1, 0.62 + (13 - (high || 13)) / 12 * 0.30 + Math.max(0, 22 - (sum || 99)) * 0.006)
    : count === 3 ? Math.min(1, 0.36 + (13 - (high || 13)) / 12 * 0.28)
      : count === 2 ? Math.min(1, 0.14 + (13 - (high || 13)) / 12 * 0.15) : 0.04;
  const v = new Array(96).fill(0);
  p.hand.forEach(([rank, suit], i) => { v[i * 2] = rank / 12; v[i * 2 + 1] = suit / 3; });
  v[8] = drawRound / 3; v[9] = p.stack / 200; v[10] = stack / 200;
  v[11] = Math.min(pot, 400) / 400; v[12] = Math.min(p.bet, 10) / 10;
  v[13] = Math.min(bet, 10) / 10; v[14] = Math.min(current, 10) / 10;
  v[15] = raiseCount / 4; v[16] = remaining / 3; v[17] = phase === 'BET' ? 0 : 1;
  v[18] = last / 4; v[19] = +button; v[20] = +firstToAct; v[21] = position;
  v[22] = count / 4; v[23] = Math.min(sum, 40) / 40; v[24] = high / 13;
  v[25] = Math.min(p.hand.length - new Set(p.hand.map(c => c[0])).size, 3) / 3;
  v[26] = Math.min(p.hand.length - new Set(p.hand.map(c => c[1])).size, 3) / 3;
  v[27] = clamp(strength); v[28] = odds; v[29] = +!firstToAct; v[30] = Math.min(call, 10) / 10; v[31] = +(count === 3);
  actionMask.forEach((x, i) => { v[32 + i] = x; });
  v[38] = street; v[39] = final && last >= 2 ? 0.08 : last >= 1 ? 0.03 : -0.05;
  v[40] = +final; v[41] = +(final && count === 4 && high >= 11);
  v[42] = aggression; v[43] = 1 - aggression; v[44] = pat; v[45] = last / 4; v[46] = 0.30; v[47] = 0.05;
  const betSize = drawRound >= 2 ? 4 : 2;
  const callEV = call > 0 ? (street * (pot + call) - call) / 10 : street * pot / 10;
  v[48] = street; v[49] = odds; v[50] = clamp(callEV, -1); v[51] = clamp((street * (pot + betSize) - betSize) / 10, -1);
  v[52] = Math.max(0, (4 - count) * 0.12); v[53] = 0.30; v[54] = clamp(street * remaining * 0.25); v[55] = clamp(callEV);
  v[56] = n / 5; v[57] = n <= 1 ? 0 : Math.min(0.35, Math.max(0, 0.5 - position) * 0.24 + Math.max(0, n - 1) * 0.035);
  v[58] = range;
  v[59] = call <= 0 || n < 2 ? 0 : Math.min(0.35, (position >= 0.6 ? 0.12 : 0) + (count === 4 && high <= 9 ? 0.18 : 0) + (count === 3 && high <= 7 ? 0.10 : 0) + (pot >= 12 ? 0.05 : 0));
  v[60] = +(phase === 'BET' && n >= 1 && n <= 2 && call === 0 && currentBet === 0 && position >= 0.8 && count === 3 && (high || 13) <= 7 && remaining >= 2 && pot <= 14);
  p.betHistory.forEach((x, i) => { v[61 + i] = +x; }); v[64] = +p.openedCurrentRound;
  v[65] = p.drawHistory[0] / 3; v[66] = p.drawHistory[1] / 3; v[67] = p.lastDraw / 3;
  v[68] = clamp((hist(0) - hist(1)) / 3, -1); v[69] = clamp((hist(1) - hist(2)) / 3, -1); v[70] = clamp((last - p.lastDraw) / 3, -1);
  v[71] = Math.min(1, p.discarded.filter(c => c[0] === 0).length / 4); v[72] = Math.min(1, p.discarded.filter(c => c[0] <= 3).length / 16);
  v[73] = +!button; v[74] = Math.min(1, stack / Math.max(1, p.stack) / 2);
  return v;
}
