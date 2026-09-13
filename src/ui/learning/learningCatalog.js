import { normalizeAppVariantId } from '../game/appVariantRouting.js';
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from '../../config/mgxLocaleConfig.js';

// Reviewed against controller definitions, not display-only multiGameList metadata.
const text = (ja, en) => ({ ja, en });
const outcomes = {
  high: text('通常の高い5枚役で比較します。', 'Compare standard high five-card hands.'),
  low27: text('Aは高いカード。ストレートとフラッシュは弱い役です。最強は7-5-4-3-2（フラッシュ以外）。', 'Aces are high. Straights and flushes count against you. Best: 7-5-4-3-2, not all one suit.'),
  lowA5: text('Aは低いカード。ストレートとフラッシュは無視します。最強は5-4-3-2-A。', 'Aces are low. Ignore straights and flushes. Best: 5-4-3-2-A.'),
  split8: text('ハイと8以下の異なる5ランクのローで分配。ローはAが低く、ストレート・フラッシュは無視。ロー不成立ならハイが総取りします。', 'Split between high and five distinct ranks eight or lower. Aces are low for low; ignore straights/flushes. No qualifying low: high takes all.'),
  badugi: text('ランクもスートも重複しない有効枚数を優先。同枚数なら高いカードから比べ、低い方が勝ちます。Aは低いカードです。', 'More unique-rank, unique-suit cards win. With equal counts, compare highest cards first; lower wins. Aces are low.'),
};
const betting = {
  'fixed-limit': text('フィックスリミット：ベット・レイズは所定額。額と上限は卓の表示を確認。', 'Fixed limit: use the set bet/raise unit. Check the table for amounts and caps.'),
  'no-limit': text('ノーリミット：最低レイズ額以上、持ち点までベットできます。', 'No limit: raise at least the legal minimum, up to your stack.'),
  'pot-limit': text('ポットリミット：上限はポット額を基準に決まります。', 'Pot limit: the maximum raise is determined by the pot.'),
};
const structures = {
  holdem: text('手札2枚とボード5枚から最善の5枚。手札の使用枚数は自由です。', 'Best five from two hole cards and five board cards; no fixed hole-card requirement.'),
  omaha: text('手札4枚から必ず2枚、ボードから必ず3枚を使います。', 'Use exactly two of four hole cards and exactly three board cards.'),
  stud: text('自分の7枚から5枚。通常は表4枚・裏3枚。交換はありません。', 'Best five of your seven cards, normally four up and three down. No draws.'),
  draw3: text('手札5枚。交換は3回、ベットは4ラウンドです。', 'Five hole cards, three draws and four betting rounds.'),
  draw1: text('手札5枚。交換は1回、ベットは2ラウンドです。', 'Five hole cards, one draw and two betting rounds.'),
  badugi: text('手札4枚。交換は3回。相手の交換枚数を確認します。', 'Four hole cards and three draws. Watch opponents’ draw counts.'),
};
const actions = {
  board: text('プリフロップはBBの左から。以後はボタンの左の残ったプレイヤーから。', 'Preflop starts left of the big blind; later rounds start left of the button among remaining players.'),
  draw: text('最初はBBの左から。交換と以後のベットはボタンの左の残ったプレイヤーから。', 'Opening action starts left of the big blind; draws and later betting start left of the button among remaining players.'),
  stud: text('3rdは最も低い表カードがブリングイン。以後は表のハイ役が最も強い人から。', 'On third street the lowest upcard brings in. Later, the strongest exposed high hand acts first.'),
  razz: text('3rdは最も高い表カードがブリングイン。以後は表のローが最も強い人から。', 'On third street the highest upcard brings in. Later, the best exposed low hand acts first.'),
};
const rows = [
  ['nlh', 'B01', "NL Hold’em", 'high', 'holdem', 'no-limit', 'board'],
  ['flh', 'B02', "FL Hold’em", 'high', 'holdem', 'fixed-limit', 'board'],
  ['plo', 'B05', 'PLO', 'high', 'omaha', 'pot-limit', 'board'],
  ['plo8', 'B06', 'PLO8', 'split8', 'omaha', 'pot-limit', 'board'],
  ['flo8', 'B09', 'FLO8', 'split8', 'omaha', 'fixed-limit', 'board'],
  ['stud', 'ST1', 'Stud', 'high', 'stud', 'fixed-limit', 'stud'],
  ['stud8', 'ST2', 'Stud8', 'split8', 'stud', 'fixed-limit', 'stud'],
  ['razz', 'ST3', 'Razz', 'lowA5', 'stud', 'fixed-limit', 'razz'],
  ['deuce_to_seven_triple_draw', 'D01', '2-7 Triple Draw', 'low27', 'draw3', 'fixed-limit', 'draw'],
  ['ace_to_five_triple_draw', 'D02', 'A-5 Triple Draw', 'lowA5', 'draw3', 'fixed-limit', 'draw'],
  ['badugi', 'D03', 'Badugi', 'badugi', 'badugi', 'fixed-limit', 'draw'],
  ['deuce_to_seven_single_draw', 'S01', '2-7 Single Draw', 'low27', 'draw1', 'fixed-limit', 'draw'],
  ['ace_to_five_single_draw', 'S02', 'A-5 Single Draw', 'lowA5', 'draw1', 'fixed-limit', 'draw'],
];
export const LEARNING_GAMES = rows.map(([id, catalogId, name, outcome, structure, limit, action]) => ({
  id, catalogId, name, outcome, structure, betting: limit, action,
}));
export function readLearningLanguage() {
  try { const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY); return ['ja', 'en'].includes(saved) ? saved : MGX_DEFAULT_LOCALE; }
  catch { return MGX_DEFAULT_LOCALE; }
}
export function getLearningGame(id) {
  const normalized = normalizeAppVariantId(id, null);
  return LEARNING_GAMES.find(game => game.id === normalized) ?? null;
}
export function getRuleRows(id, language = 'ja', previousId = null) {
  const game = getLearningGame(id);
  if (!game) return [];
  const previous = getLearningGame(previousId);
  const lang = language === 'ja' ? 'ja' : 'en';
  return [
    ['outcome', text('勝敗とAの扱い', 'Winning hand and aces'), outcomes],
    ['structure', text('カードと交換', 'Cards and draws'), structures],
    ['betting', text('ベット形式', 'Betting'), betting],
    ['action', text('手番', 'Action order'), actions],
  ].map(([key, label, dictionary]) => ({
    key, label: label[lang], value: dictionary[game[key]][lang],
    changed: Boolean(previous && previous[key] !== game[key]),
    previous: previous ? dictionary[previous[key]][lang] : null,
  }));
}
export const LEARNING_PRESETS = [
  { id: 'learn-lowball', name: 'Lowball Basics', title: text('ローの違いを覚える', 'Learn the lowball differences'), description: text('A-5 → 2-7 → Badugi。Aと役の扱いを確認。', 'A-5 → 2-7 → Badugi. Compare aces and hand rankings.'), selectedGameIds: ['D02', 'D01', 'D03'], handsPerGame: 4 },
  { id: 'learn-horse', name: 'HORSE Practice', title: text('HORSEを一巡する', 'Explore a HORSE rotation'), description: text('5種目の勝敗・手番を順番に確認。', 'Review the winning hand and action order across five games.'), selectedGameIds: ['B02', 'B09', 'ST3', 'ST1', 'ST2'], handsPerGame: 4 },
  { id: 'learn-8game', name: '8-Game Warm-up', title: text('8-Gameの切替を確認', 'Rehearse 8-Game transitions'), description: text('固定リミットからNLH・PLOへの変更を確認。', 'Review the switch from fixed limit to NLH and PLO.'), selectedGameIds: ['D01', 'B02', 'B09', 'ST3', 'ST1', 'ST2', 'B01', 'B05'], handsPerGame: 6 },
].map(preset => ({ ...preset, formatLabel: preset.name, selectionMode: 'FIXED', allowDuplicates: false }));
