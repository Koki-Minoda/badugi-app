export function createSeededRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return function seededRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function installSeededRandom(seed) {
  const random = createSeededRandom(seed);
  Math.random = random;
  return seed;
}
