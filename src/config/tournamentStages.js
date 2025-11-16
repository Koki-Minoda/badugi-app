export const TOURNAMENT_STAGES = [
  {
    id: "store",
    name: "店舗",
    actionLimitSeconds: 3,
    timebankInitial: 5,
    recovery: "なし",
    cap: 5,
  },
  {
    id: "local",
    name: "地方",
    actionLimitSeconds: 4,
    timebankInitial: 10,
    recovery: "+1秒/2H",
    cap: 15,
  },
  {
    id: "national",
    name: "全国",
    actionLimitSeconds: 5,
    timebankInitial: 15,
    recovery: "+2秒/LV",
    cap: 20,
  },
  {
    id: "world",
    name: "世界",
    actionLimitSeconds: 6,
    timebankInitial: 20,
    recovery: "+3秒/突破",
    cap: 25,
  },
];
