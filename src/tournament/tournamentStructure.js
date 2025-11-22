export const DEFAULT_STARTING_STACK = 500;
export const DEFAULT_SEAT_TYPES = [
  "HUMAN",
  "CPU",
  "CPU",
  "CPU",
  "CPU",
  "CPU",
];

export const TOURNAMENT_STRUCTURE = [
  { level: 1, sb: 10, bb: 20, ante: 0, hands: 8 },
  { level: 2, sb: 15, bb: 30, ante: 0, hands: 8 },
  { level: 3, sb: 20, bb: 40, ante: 5, hands: 10 },
  { level: 4, sb: 30, bb: 60, ante: 10, hands: 12 },
  { level: 5, sb: 50, bb: 100, ante: 15, hands: 999 },
];
