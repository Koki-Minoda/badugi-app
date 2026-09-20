export const CLOCK_KEY = 'mgx.table-clock.v1';
export const TIMER_PRESETS = {
  short: { minutes: 5, stack: 1000 }, standard: { minutes: 10, stack: 2000 }, long: { minutes: 20, stack: 4000 },
};
export function clockLevels(preset = 'standard') {
  const p = TIMER_PRESETS[preset] ?? TIMER_PRESETS.standard;
  return [20, 40, 60, 100, 150, 200, 300, 400, 600, 800, 1200, 1600].map((bb, i) => ({ sb: bb / 2, bb, ante: 0, bringIn:Math.max(1,Math.floor(bb/4)), smallBet:bb, bigBet:bb*2, minutes: p.minutes, level: i + 1 }));
}
export function validateClock(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.levels) || !value.levels.length || value.levels.length > 60 || !Number.isInteger(value.index) || value.index < 0 || value.index >= value.levels.length || !['level','break'].includes(value.phase)) throw new Error('Invalid clock');
  for (const level of value.levels) if (![level.sb, level.bb, level.ante].every(n => Number.isInteger(n) && n >= 0 && n <= 10000000) || level.sb > level.bb || level.bb < 1 || !Number.isFinite(level.minutes) || level.minutes < 1 || level.minutes > 120) throw new Error('Invalid level');
  for (const level of value.levels) if (['bringIn','smallBet','bigBet'].some(key => level[key] !== undefined && (!Number.isInteger(level[key]) || level[key] < 1 || level[key] > 10000000)) || (level.bringIn ?? level.sb) > (level.smallBet ?? level.bb) || (level.smallBet ?? level.bb) > (level.bigBet ?? level.bb*2)) throw new Error('Invalid Stud bets');
  if (!Number.isInteger(value.breakEvery) || value.breakEvery < 0 || value.breakEvery > 60 || !Number.isInteger(value.breakMinutes) || value.breakMinutes < 1 || value.breakMinutes > 60 || !Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > 7200000 || (value.deadline !== null && (!Number.isFinite(value.deadline) || value.deadline < 0))) throw new Error('Invalid clock time');
  return value;
}
export function newClock(preset = 'standard') {
  const levels = clockLevels(preset);
  return { version: 1, levels, index: 0, phase: 'level', breakEvery: 4, breakMinutes: 5, remainingMs: levels[0].minutes * 60000, deadline: null, ended: false, gameId: 'badugi' };
}
export function advanceClock(clock, now = Date.now()) {
  if (clock.deadline === null || clock.ended) return clock;
  let next = { ...clock };
  // Advance from the scheduled deadline, never from the time a sleeping tab wakes.
  for (let i = 0; now >= next.deadline && i < 121; i++) {
    if (next.phase === 'level' && next.index === next.levels.length - 1) return { ...next, deadline: null, remainingMs: 0, ended: true };
    if (next.phase === 'level' && next.breakEvery > 0 && (next.index + 1) % next.breakEvery === 0) {
      next.phase = 'break'; next.remainingMs = next.breakMinutes * 60000;
    } else {
      next.phase = 'level'; next.index += 1; next.remainingMs = next.levels[next.index].minutes * 60000;
    }
    next.deadline += next.remainingMs;
  }
  return { ...next, remainingMs: Math.max(0, next.deadline - now) };
}
export function toggleClock(clock, now = Date.now()) {
  validateClock(clock);
  const current = advanceClock(clock, now);
  if (current.ended) return current;
  return current.deadline === null ? { ...current, deadline: now + current.remainingMs } : { ...current, deadline: null };
}
export function readClock() {
  try { const raw = localStorage.getItem(CLOCK_KEY); return raw ? advanceClock(validateClock(JSON.parse(raw))) : newClock(); }
  catch { return newClock(); }
}
