const EN = {
  title: "Hand Result", pot: "Pot", mainPot: "Main Pot", sidePot: "Side Pot", seat: "Seat ",
  winner: "Winner", winners: "Winners", high: "High", low: "Low", badugi: "Badugi",
  component: "Component pot", eligible: "Eligible", noWinners: "No eligible winners",
  stack: "Stack", collect: "Collect", dead: "Dead", prompt: "Choose your next action",
  next: "Next hand", history: "History & Replay", leave: "Cash Out", mixed: "Mixed Game",
  format: "Format", current: "Current", nextGame: "Next", betting: "Betting", remaining: "Remaining",
  followUp: "Follow-up", review: "Review",
  chips: value => `${value} chips`,
  oddChip: (value, component) => `Odd chip +${value} to ${component ?? "this component"}`,
  components: { badugi: "Badugi half", low27: "2-7 Low half", lowA5: "A-5 Low half", archieHigh: "High half", archieLow: "A-5 Low half", archieChop: "No qualifier · split pot", board: "High / Board half", draw: "Draw half" },
};
const JA = {
  title: "ハンドの結果", pot: "ポット", mainPot: "メインポット", sidePot: "サイドポット", seat: "席",
  winner: "勝者", winners: "獲得したプレイヤー", high: "ハイ", low: "ロー", badugi: "バドゥーギ",
  component: "分配区分", eligible: "対象席", noWinners: "該当する勝者なし",
  stack: "持ち点", collect: "獲得", dead: "役に使わないカード", prompt: "次の操作を選んでください",
  next: "次のハンドへ", history: "履歴・リプレイ", leave: "テーブルを離れる", mixed: "ミックスゲーム",
  format: "形式", current: "現在の種目", nextGame: "次の種目", betting: "ベット形式", remaining: "残り",
  followUp: "振り返り", review: "確認する",
  chips: value => `${value} チップ`,
  oddChip: (value, component) => `端数 ${value} チップを${component ?? "この区分"}に加算`,
  components: { badugi: "バドゥーギ分", low27: "2-7ロー分", lowA5: "A-5ロー分", archieHigh: "ハイ分", archieLow: "A-5ロー分", archieChop: "成立役なし・均等分配", board: "ボードのハイ分", draw: "ドロー分" },
};
export const getHandResultCopy = language => language === "ja" ? JA : EN;
const HAND_NAMES_JA = {
  "high card": "ハイカード", "one pair": "ワンペア", "pair": "ワンペア", "two pair": "ツーペア",
  "three of a kind": "スリーカード", "straight": "ストレート", "flush": "フラッシュ", "full house": "フルハウス",
  "four of a kind": "フォーカード", "straight flush": "ストレートフラッシュ", "royal flush": "ロイヤルフラッシュ",
  "no qualifying hand": "成立役なし",
};
export function localizeResultHandLabel(label, language) {
  if (language !== "ja") return label;
  const text = String(label);
  const badugi = text.match(/^Badugi ([1-4])-card$/i);
  if (badugi) return `${badugi[1]}枚バドゥーギ`;
  return HAND_NAMES_JA[text.toLowerCase()] ?? label;
}
