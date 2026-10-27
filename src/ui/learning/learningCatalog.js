import { GAME_VARIANTS } from '../../games/config/variantCatalog.js';
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
  ['deuce_to_seven_single_draw', 'S01', '2-7 Single Draw', 'low27', 'draw1', 'no-limit', 'draw'],
  ['ace_to_five_single_draw', 'S02', 'A-5 Single Draw', 'lowA5', 'draw1', 'fixed-limit', 'draw'],
];
Object.assign(outcomes, {
  razzducey: text('MGXではBadugi（Aは低い）と2-7ロー（Aは高い）で半分ずつ分配します。', 'MGX splits between ace-low Badugi and ace-high 2-7 low.'),
  splitA5: text('ポットの半分ずつをBadugiとA-5ローで争います。それぞれ別のカードを使えます。', 'Half the pot goes to Badugi, half to A-5 low. Each half can use different cards.'),
  split27: text('ポットの半分ずつをBadugi（Aは高い）と2-7ローで争います。2-7側はAが高く、ストレートとフラッシュは不利です。', 'Split between Ace-high Badugi and 2-7 low. Aces are high and straights/flushes count against the 2-7 half.'),
  hidugi: text('スートの異なるカードを多く揃え、同枚数なら高いランクで勝負します。同じランクも使え、4枚のAが最強です。', 'Use as many distinct suits as possible. Repeated ranks play; four aces is best.'),
  archie: text('ハイは9のペア以上、ローは8以下の異なる5ランクが条件。片側だけ成立なら総取り。両側とも不成立なら、残ったプレイヤーでポットを均等に分けます。', 'High needs a pair of nines or better; low needs five distinct ranks eight or lower. A lone qualifying half scoops. If neither qualifies, remaining players split the pot equally.'),
  dramahaHigh: text('半分はOmahaのハイ、半分は手札5枚のハイで争います。', 'Half for Omaha high, half for the high hand in your five hole cards.'),
  dramaha27: text('半分はOmahaのハイ、半分は手札5枚の2-7ローで争います。', 'Split between Omaha high and 2-7 low in your five hole cards.'),
  dramahaA5: text('半分はOmahaのハイ、半分は手札5枚のA-5ローで争います。', 'Split between Omaha high and A-5 low in your five hole cards.'),
  dramahaZero: text('半分はOmahaのハイ、半分は手札の合計が小さい方へ。Aは1、絵札は0です。', 'Split between Omaha high and the lowest hole-card total. Ace is 1; face cards are 0.'),
  dramahaBadugi: text('半分はOmahaのハイ、半分は手札から作るBadugiで争います。', 'Split between Omaha high and Badugi made from your hole cards.'),
  dramahaHidugi: text('半分はOmahaのハイ、残り半分は手札の異なるスートで作るHidugi。A4枚が最強です。', 'Split between Omaha high and Hidugi from your hole cards. Four aces is best.'),
  chinese: text('前3枚・中5枚・後5枚を相手と比較。後の役を中以上、中の役を前以上に揃えます。', 'Compare front (3), middle (5) and back (5) rows. Back must be at least as strong as middle, and middle at least as strong as front.'),
});
Object.assign(structures, {
  omaha5: text('手札5枚から必ず2枚、ボードから必ず3枚を使います。交換はありません。', 'Use exactly two of five hole cards and three board cards. No draws.'),
  super: text('手札3枚とボード5枚から最善の5枚を使います。交換はありません。', 'Choose the best five from three hole cards and five board cards. No draws.'),
  badugi1: text('手札4枚。交換は1回です。', 'Four hole cards and one draw.'),
  dramaha: text('手札5枚、フロップ後に1回交換。Omaha側は手札2枚とボード3枚を使います。', 'Five hole cards, one draw after the flop. Omaha uses two hole cards and three board cards.'),
  dramaha3: text('手札5枚、フロップ後に最大3枚を1回交換。Omaha側は手札2枚とボード3枚。', 'Five hole cards; draw up to three once after the flop. Omaha uses two hole cards and three board cards.'),
  chinese: text('13枚を前・中・後へ配置し、すべて揃えてから確定します。', 'Place all 13 cards into front, middle and back, then confirm.'),
  ofc: text('最初に5枚、以後は1枚ずつ配置。確定したカードは動かせません。', 'Place five cards initially, then one at a time. Confirmed cards cannot move.'),
});
betting.points = text('ベットはなく、列の勝敗とボーナスを点数で精算します。', 'No betting. Score the rows and bonuses in points.');
actions.chinese = text('配置を確認して確定します。', 'Review your placement, then confirm.');
const extraRules = {
 B03:['high','super','board'], B04:['high','super','board'], B07:['split8','omaha5','board'], B08:['high','omaha5','board'],
 D04:['split27','draw3','draw'], D05:['splitA5','draw3','draw'], D06:['hidugi','badugi','draw'], D07:['archie','draw3','draw'],
 S03:['high','draw1','draw'], S04:['badugi','badugi1','draw'], S05:['split27','draw1','draw'], S06:['splitA5','draw1','draw'], S07:['hidugi','badugi1','draw'],
 H01:['dramahaHigh','dramaha','board'], H02:['dramaha27','dramaha','board'], H03:['dramahaA5','dramaha','board'], H04:['dramahaZero','dramaha3','board'], H05:['dramahaHidugi','dramaha3','board'], H06:['dramahaBadugi','dramaha3','board'],
 ST4:['splitA5','stud','razz'], ST5:['razzducey','stud','razz'], ST6:['low27','stud','razz'], CP1:['chinese','chinese','chinese'], CP2:['chinese','ofc','chinese'],
};
for (const game of GAME_VARIANTS) {
  if (rows.some(row => row[1] === game.id)) continue;
  const [outcome, structure, action] = extraRules[game.id] ?? [];
  if (outcome) rows.push([game.engineKey, game.id, game.name, outcome, structure, game.betting, action]);
}
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
const winningHandCues = {
  high: text('高い役が勝ち', 'High hand wins'),
  low27: text('2-7ロー · Aは高い', '2-7 low · Aces high'),
  lowA5: text('A-5ロー · Aは低い', 'A-5 low · Aces low'),
  split8: text('ハイと8以下のローで分配', 'High / 8-low split'),
  badugi: text('Badugi · 枚数と低さで勝負', 'Badugi · more cards, then lower'),
  razzducey: text('Badugi / 2-7ローで分配', 'Badugi / 2-7 low split'),
  splitA5: text('Badugi / A-5ローで分配', 'Badugi / A-5 low split'),
  split27: text('Badugi / 2-7ローで分配', 'Badugi / 2-7 low split'),
  hidugi: text('Hidugi · 異なるスートが優先', 'Hidugi · distinct suits first'),
  archie: text('Archie · 9ペア以上 / 8ロー', 'Archie · 9-pair+ / 8-low'),
  dramahaHigh: text('Omaha / 手札ハイで分配', 'Omaha / hole-card high split'),
  dramaha27: text('Omaha / 2-7ローで分配', 'Omaha / 2-7 low split'),
  dramahaA5: text('Omaha / A-5ローで分配', 'Omaha / A-5 low split'),
  dramahaZero: text('Omaha / 手札の最小合計で分配', 'Omaha / lowest hole total split'),
  dramahaBadugi: text('Omaha / Badugiで分配', 'Omaha / Badugi split'),
  dramahaHidugi: text('Omaha / Hidugiで分配', 'Omaha / Hidugi split'),
  chinese: text('前・中・後の列で得点を競う', 'Score the front, middle and back rows'),
};
export function getWinningHandCue(id, language = 'ja') {
  const outcome = getLearningGame(id)?.outcome;
  return winningHandCues[outcome]?.[language === 'ja' ? 'ja' : 'en'] ?? null;
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
