import { evaluateBadugi } from '../../games/badugi/utils/badugiEvaluator.js';
import { PRACTICE_CARDS } from '../practice/practiceSetup.js';

const maxPerGroup = 8;

export const BADUGI_RANGE_PRESETS = [
  { id: 'pat-low', draw: 0, groups: ['4-low'], label: ['8以下の完成手', 'Made eight-high or better'] },
  { id: 'pat-mixed', draw: 0, groups: ['4-low', '4-high'], label: ['9〜Kの完成手も含む', 'Include nine- to king-high made hands'] },
  { id: 'one-low', draw: 1, groups: ['3-low'], label: ['3枚残し・8以下中心', 'Keep three, eight-high or better'] },
  { id: 'one-mixed', draw: 1, groups: ['3-low', '3-high'], label: ['3枚残し・9〜Kも含む', 'Keep three, include nine- to king-high'] },
  { id: 'two-low', draw: 2, groups: ['2-low'], label: ['2枚残し・8以下中心', 'Keep two, eight-high or better'] },
  { id: 'two-mixed', draw: 2, groups: ['2-low', '2-high'], label: ['2枚残し・9〜Kも含む', 'Keep two, include nine- to king-high'] },
  { id: 'three-low', draw: 3, groups: ['1-low'], label: ['1枚残し・8以下中心', 'Keep one, eight or lower'] },
  { id: 'three-mixed', draw: 3, groups: ['1-low', '1-high'], label: ['1枚残し・9〜Kも含む', 'Keep one, include nine through king'] },
];

export function orderedRangePresets(draw) {
  return [...BADUGI_RANGE_PRESETS].sort((a, b) => Math.abs(a.draw - draw) - Math.abs(b.draw - draw));
}

export function rangeAssumptionName(preset, ja) {
  return BADUGI_RANGE_PRESETS.find(option => option.id === preset)?.label[ja ? 0 : 1]
    ?? (ja ? '編集したレンジ' : 'Custom range');
}

/** Keep deterministic representative samples of legal four-card opponent hands. */
export function generateBadugiRangePresets({ hero, deadCards = [] }) {
  const blocked = new Set([...hero, ...deadCards]);
  const stock = PRACTICE_CARDS.filter(card => !blocked.has(card));
  const groups = new Map(BADUGI_RANGE_PRESETS.flatMap(preset => preset.groups).map(group => [group, { size: 0, hands: [] }]));
  let seed = 0x23ab79f1;
  for (let a = 0; a < stock.length - 3; a += 1) {
    for (let b = a + 1; b < stock.length - 2; b += 1) {
      for (let c = b + 1; c < stock.length - 1; c += 1) {
        for (let d = c + 1; d < stock.length; d += 1) {
          const cards = [stock[a], stock[b], stock[c], stock[d]];
          const rank = evaluateBadugi(cards);
          const group = groups.get(`${rank.count}-${rank.kicker <= 8 ? 'low' : 'high'}`);
          group.size += 1;
          // Reservoir sampling selects across all eligible suits and ranks.
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const slot = group.size <= maxPerGroup ? group.size - 1 : Math.floor(seed / 2 ** 32 * group.size);
          if (slot < maxPerGroup) group.hands[slot] = cards;
        }
      }
    }
  }

  return Object.fromEntries(BADUGI_RANGE_PRESETS.map(({ id, groups: ids }) => {
    const entries = ids.map(group => groups.get(group));
    if (entries.some(({ size }) => size === 0)) return [id, null];
    const text = entries.flatMap(({ hands }, index) => hands.map(cards =>
      `${cards.join(' ')} ${entries[1 - index]?.hands.length ?? 1}`)).join('\n');
    return [id, { text }];
  }));
}
