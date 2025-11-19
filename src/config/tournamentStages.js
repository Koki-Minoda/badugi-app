export const TOURNAMENT_STAGE_IDS = ["store", "local", "national", "world"];

const TABLE_SIZE = 6;

export const TOURNAMENT_STAGES = [
  {
    id: "store",
    label: "店舗",
    description: "無料の店舗トーナメント。ここでバンクロールを増やして上位ステージを解放する。",
    entryFee: 0,
    participantsRange: [15, 20],
    tableSize: TABLE_SIZE,
    startingStack: 500,
    actionSeconds: 3,
    timebankInitial: 5,
    timebankRecovery: "+1s / 2 hands",
    difficulty: 1,
    prizeTable: [
      { places: [1, 1], payout: 1000, note: "地方エントリーチケット相当" },
      { places: [2, 2], payout: 600 },
      { places: [3, 3], payout: 400 },
    ],
    eligibility: {
      requires: null,
      text: "エントリー無料（いつでも参加可能）",
    },
  },
  {
    id: "local",
    label: "地方",
    description: "地区代表を決める中規模MTT。テンポが一段階速い。",
    entryFee: 1000,
    participantsRange: [40, 50],
    tableSize: TABLE_SIZE,
    startingStack: 800,
    actionSeconds: 4,
    timebankInitial: 10,
    timebankRecovery: "+1s / level",
    difficulty: 2,
    prizeTable: [
      { places: [1, 1], payout: 12000 },
      { places: [2, 2], payout: 7500 },
      { places: [3, 3], payout: 4000 },
      { places: [4, 5], payout: 2200 },
      { places: [6, 8], payout: 1000 },
    ],
    eligibility: {
      requires: { storeWins: 1 },
      text: "店舗優勝 1 回以上",
    },
  },
  {
    id: "national",
    label: "全国",
    description: "全国大会。フィールドも賞金も大きく、緊張感が高まる。",
    entryFee: 3000,
    participantsRange: [70, 100],
    tableSize: TABLE_SIZE,
    startingStack: 1200,
    actionSeconds: 5,
    timebankInitial: 15,
    timebankRecovery: "+2s / level",
    difficulty: 3,
    prizeTable: [
      { places: [1, 1], payout: 35000 },
      { places: [2, 2], payout: 25000 },
      { places: [3, 3], payout: 15000 },
      { places: [4, 4], payout: 10000 },
      { places: [5, 7], payout: 7000 },
      { places: [8, 12], payout: 5500 },
      { places: [13, 15], payout: 3800 },
    ],
    eligibility: {
      requires: { localWins: 1 },
      text: "地方優勝 1 回以上",
    },
  },
  {
    id: "world",
    label: "世界",
    description: "世界王者を決める戦い。ロングストラクチャで要求レベルも最高。",
    entryFee: 7500,
    participantsRange: [250, 300],
    tableSize: TABLE_SIZE,
    startingStack: 2000,
    actionSeconds: 6,
    timebankInitial: 20,
    timebankRecovery: "+3s / level",
    difficulty: 4,
    prizeTable: [
      { places: [1, 1], payout: 110000 },
      { places: [2, 2], payout: 80000 },
      { places: [3, 3], payout: 55000 },
      { places: [4, 4], payout: 38000 },
      { places: [5, 5], payout: 22000 },
      { places: [6, 7], payout: 18000 },
      { places: [8, 9], payout: 12000 },
      { places: [10, 15], payout: 9000 },
      { places: [16, 20], payout: 7500 },
    ],
    eligibility: {
      requires: { nationalWins: 2 },
      text: "全国優勝 2 回以上",
    },
  },
];

export function getStageById(stageId) {
  return TOURNAMENT_STAGES.find((stage) => stage.id === stageId);
}
