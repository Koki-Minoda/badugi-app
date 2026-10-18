const KEY = 'mgx.tournament.structure.v1';
export const STRUCTURE_PRESETS = {
  short: { name: 'Short', startingStack: 500, levelMinutes: 3, breakEvery: 0, breakMinutes: 5 },
  standard: { name: 'Standard', startingStack: 1000, levelMinutes: 8, breakEvery: 6, breakMinutes: 5 },
  long: { name: 'Long', startingStack: 2000, levelMinutes: 15, breakEvery: 6, breakMinutes: 5 },
};
export function validateStructure(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) throw new Error('Invalid name');
  for (const [key,min,max] of [['startingStack',100,100000],['levelMinutes',1,120],['breakEvery',0,30],['breakMinutes',1,60]]) if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) throw new Error(`Invalid ${key}`);
  if (!Array.isArray(input.levels) || !input.levels.length || input.levels.length > 40) throw new Error('Invalid levels');
  const levels = input.levels.map((l,i) => {
    if (![l.sb,l.bb,l.ante].every(n => Number.isInteger(n) && n >= 0 && n <= 1000000) || l.bb < 1 || l.sb > l.bb || (i > 0 && l.bb < input.levels[i-1].bb)) throw new Error('Invalid bets');
    return { levelIndex: i+1, level: i+1, sb: l.sb, bb: l.bb, ante: l.ante, hands: 999999, handsThisLevel: 999999 };
  });
  return { name: input.name.trim(), startingStack: input.startingStack, levelMinutes: input.levelMinutes, breakEvery: input.breakEvery, breakMinutes: input.breakMinutes, levels };
}
export function structurePreset(id, levels) { return validateStructure({ ...STRUCTURE_PRESETS[id], levels }); }
export function saveStructure(value) { const normalized = validateStructure(value); localStorage.setItem(KEY, JSON.stringify(normalized)); return normalized; }
export function readStructure(levels) { try { return validateStructure(JSON.parse(localStorage.getItem(KEY))); } catch { return structurePreset('standard', levels); } }
export function applyCustomStructure(base, draft) {
  const structure = validateStructure(draft);
  return { ...base, id: `custom-${base.id}`, name: structure.name, customStructure: structure, practiceOnly: true, startingStack: structure.startingStack, levels: structure.levels.map(l => ({ ...l })), levelProgression: 'clock', levelDurationMinutes: structure.levelMinutes, breakEveryLevels: structure.breakEvery, breakDurationMinutes: structure.breakMinutes, entryFee: 0, buyIn: 0, rewards: [], payouts: [], prizePoolTotal: 0 };
}
