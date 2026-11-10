export const CORE_GAMES = Object.freeze([
  { id: 'B01', appId: 'nlh', name: 'NLH' },
  { id: 'B05', appId: 'plo', name: 'PLO' },
  { id: 'B09', appId: 'flo8', name: 'FLO8' },
  { id: 'ST1', appId: 'stud', name: 'Stud' },
  { id: 'ST2', appId: 'stud8', name: 'Stud8' },
  { id: 'ST3', appId: 'razz', name: 'Razz' },
  { id: 'D01', appId: 'deuce_to_seven_triple_draw', name: '2-7 Triple Draw' },
  { id: 'D02', appId: 'ace_to_five_triple_draw', name: 'A-5 Triple Draw' },
  { id: 'D03', appId: 'badugi', name: 'Badugi' },
  { id: 'S01', appId: 'deuce_to_seven_single_draw', name: '2-7 Single Draw' },
].map(Object.freeze));

export const RELEASE_GATES = Object.freeze({
  G0: 'Critical Stability', G1: 'Core Game Quality', G2: 'Tournament',
  G3: 'UI / UX', G4: 'Visual Design', G5: 'Learning Loop',
  G6: 'Coach Quality', G7: 'Release Operations',
});

export const CORE_QA_TARGETS = Object.freeze({
  engineHandsPerGame: 10000, seedsPerGame: 10,
  browserHandsPerProfile: 100, browserProfiles: ['desktop', 'android', 'iphone'],
  continuousSessionMinutes: 120,
});
