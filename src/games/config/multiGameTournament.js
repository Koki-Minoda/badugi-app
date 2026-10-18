export function multiGameVariantForTable(state, tableId, { nextRotation = false } = {}) {
  const config = state?.config?.multiGame;
  if (!config) return null;
  const table = state.tables.find(t => t.tableId === tableId);
  const hands = table?.totalHandsPlayed ?? 0;
  const final = config.format === 'championship' && state.playersRemaining <= 6;
  const sequence = final ? config.finalSequence : config.sequence;
  const offset = config.format === 'survival' ? Math.max(0, state.tables.findIndex(t => t.tableId === tableId)) : 0;
  return sequence[(Math.floor((final ? Math.max(0, hands - (table?.finalStartHand ?? hands)) : hands) / (final ? 1 : config.handsPerGame)) + offset + (nextRotation ? 1 : 0)) % sequence.length];
}
