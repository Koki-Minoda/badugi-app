export function npcAutoDrawCount(evalResult = {}) {
  const ranks = evalResult?.ranks ?? [];
  const kicker = evalResult?.kicker ?? 13;
  const uniqueCount = ranks.length;

  if (uniqueCount <= 1) return 3;
  if (uniqueCount === 2) {
    if (kicker >= 10) return 3;
    if (kicker >= 7) return 2;
    return 1;
  }
  if (uniqueCount === 3) {
    if (kicker >= 10) return 2;
    if (kicker >= 7) return 1;
    return 0;
  }
  return kicker >= 11 ? 1 : 0;
}
