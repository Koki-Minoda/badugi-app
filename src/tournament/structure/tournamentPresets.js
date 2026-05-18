export const ANTE_MODES = Object.freeze({
  NONE: "none",
  BB_ANTE: "bb_ante",
  FULL_ANTE: "full_ante",
});

export const TOURNAMENT_PRESETS = Object.freeze([
  {
    id: "store-turbo",
    label: "Store Turbo",
    target: "store",
    initialStackBb: 20,
    startingBigBlind: 20,
    blindIntervalMinutes: 1,
    targetDurationMinutes: [12, 15],
    anteMode: ANTE_MODES.BB_ANTE,
    anteStartLevel: 2,
    blindGrowth: 1.42,
    notes: "Fast friend/store preset. Expected to become push-fold early.",
  },
  {
    id: "regional",
    label: "Regional",
    target: "regional",
    initialStackBb: 40,
    startingBigBlind: 20,
    blindIntervalMinutes: 2,
    targetDurationMinutes: [25, 35],
    anteMode: ANTE_MODES.BB_ANTE,
    anteStartLevel: 3,
    blindGrowth: 1.35,
    notes: "Short but still decision-bearing default for quick competitive play.",
  },
  {
    id: "national",
    label: "National",
    target: "national",
    initialStackBb: 75,
    startingBigBlind: 20,
    blindIntervalMinutes: 4,
    targetDurationMinutes: [40, 55],
    anteMode: ANTE_MODES.BB_ANTE,
    anteStartLevel: 3,
    blindGrowth: 1.32,
    notes: "Skill-expression preset for longer alpha tournament checks.",
  },
  {
    id: "world",
    label: "World Championship",
    target: "world",
    initialStackBb: 100,
    startingBigBlind: 20,
    blindIntervalMinutes: 5,
    targetDurationMinutes: [55, 75],
    anteMode: ANTE_MODES.BB_ANTE,
    anteStartLevel: 3,
    blindGrowth: 1.3,
    notes: "Flagship short-world structure; full ante can be enabled as a pressure variant.",
  },
]);

export function getTournamentPreset(presetId) {
  return TOURNAMENT_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function withAnteMode(preset, anteMode = preset?.anteMode) {
  return {
    ...preset,
    anteMode: Object.values(ANTE_MODES).includes(anteMode) ? anteMode : preset?.anteMode ?? ANTE_MODES.NONE,
  };
}
