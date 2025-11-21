import { getBlindSheetById } from "./tournamentBlindSheets";

export const TOURNAMENT_STAGE_IDS = ["store", "local", "national", "world"];

const TABLE_SIZE = 6;

export const TOURNAMENT_STAGES = [
  {
    id: "store",
    label: "店舗",
    description:
      "無料開催の店舗トーナメント。ここでバンクロールを増やして上位ステージを解放します。",
    entryFee: 0,
    participantsRange: [15, 20],
    tableSize: TABLE_SIZE,
    startingStack: 500,
    blindSheetId: "store-standard",
    actionSeconds: 3,
    timebankInitial: 5,
    timebankRecovery: "+1s / 2 hands",
    difficulty: 1,
    prizeTable: [
      { places: [1, 1], payout: 1_000, note: "地方エントリー相当" },
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
    description:
      "地区代表を決める中規模 MTT。テンポも一段階速く、上位入賞で全国への切符を得ます。",
    entryFee: 1_000,
    participantsRange: [40, 50],
    tableSize: TABLE_SIZE,
    startingStack: 800,
    blindSheetId: "local-regional",
    actionSeconds: 4,
    timebankInitial: 10,
    timebankRecovery: "+1s / level",
    difficulty: 2,
    prizeTable: [
      { places: [1, 1], payout: 12_000 },
      { places: [2, 2], payout: 7_500 },
      { places: [3, 3], payout: 4_000 },
      { places: [4, 5], payout: 2_200 },
      { places: [6, 8], payout: 1_000 },
    ],
    eligibility: {
      requires: { storeWins: 1 },
      text: "店舗優勝が1回以上で参加可能",
    },
  },
  {
    id: "national",
    label: "全国",
    description:
      "全国大会。フィールドも賞金も大きく、集中力が試されます。優勝で世界ステージの挑戦権。",
    entryFee: 3_000,
    participantsRange: [70, 100],
    tableSize: TABLE_SIZE,
    startingStack: 1_200,
    blindSheetId: "national-premier",
    actionSeconds: 5,
    timebankInitial: 15,
    timebankRecovery: "+2s / level",
    difficulty: 3,
    prizeTable: [
      { places: [1, 1], payout: 35_000 },
      { places: [2, 2], payout: 25_000 },
      { places: [3, 3], payout: 15_000 },
      { places: [4, 4], payout: 10_000 },
      { places: [5, 7], payout: 7_000 },
      { places: [8, 12], payout: 5_500 },
      { places: [13, 15], payout: 3_800 },
    ],
    eligibility: {
      requires: { localWins: 1 },
      text: "地方優勝が1回以上で参加可能",
    },
    proBlindSheetId: "national-premier-pro",
  },
  {
    id: "world",
    label: "世界",
    description:
      "世界王者を決める戦い。ロングストラクチャで要求レベルも最高。優勝で全モード解放。",
    entryFee: 7_500,
    participantsRange: [250, 300],
    tableSize: TABLE_SIZE,
    startingStack: 2_000,
    blindSheetId: "world-championship",
    actionSeconds: 6,
    timebankInitial: 20,
    timebankRecovery: "+3s / level",
    difficulty: 4,
    prizeTable: [
      { places: [1, 1], payout: 110_000 },
      { places: [2, 2], payout: 80_000 },
      { places: [3, 3], payout: 55_000 },
      { places: [4, 4], payout: 38_000 },
      { places: [5, 5], payout: 22_000 },
      { places: [6, 7], payout: 18_000 },
      { places: [8, 9], payout: 12_000 },
      { places: [10, 15], payout: 9_000 },
      { places: [16, 20], payout: 7_500 },
    ],
    eligibility: {
      requires: { nationalWins: 2 },
      text: "全国優勝が2回以上で参加可能",
    },
    proBlindSheetId: "world-championship-pro",
  },
];

export function getStageById(stageId) {
  return TOURNAMENT_STAGES.find((stage) => stage.id === stageId) ?? null;
}

export function getStageBlindSheet(stageId) {
  const stage = getStageById(stageId);
  if (!stage) return null;
  return getBlindSheetById(stage.blindSheetId);
}
