const level = (lvl, sb, bb, ante = 0) => ({ level: lvl, sb, bb, ante });

export const TOURNAMENT_BLIND_SHEETS = {
  "store-standard": {
    id: "store-standard",
    stageIds: ["store"],
    label: "店舗スタンダード",
    levelDurationMinutes: 8,
    breakEveryLevels: 6,
    breakDurationMinutes: 5,
    levels: [
      level(1, 10, 20),
      level(2, 15, 30),
      level(3, 20, 40),
      level(4, 25, 50, 5),
      level(5, 30, 60, 5),
      level(6, 40, 80, 10),
      level(7, 50, 100, 10),
      level(8, 75, 150, 15),
      level(9, 100, 200, 25),
      level(10, 150, 300, 25),
      level(11, 200, 400, 50),
      level(12, 250, 500, 75),
    ],
  },
  "local-regional": {
    id: "local-regional",
    stageIds: ["local"],
    label: "地方スタンダード",
    levelDurationMinutes: 10,
    breakEveryLevels: 5,
    breakDurationMinutes: 7,
    levels: [
      level(1, 25, 50),
      level(2, 50, 100),
      level(3, 75, 150, 25),
      level(4, 100, 200, 25),
      level(5, 150, 300, 50),
      level(6, 200, 400, 50),
      level(7, 250, 500, 75),
      level(8, 300, 600, 100),
      level(9, 400, 800, 100),
      level(10, 500, 1_000, 125),
      level(11, 600, 1_200, 150),
      level(12, 800, 1_600, 200),
      level(13, 1_000, 2_000, 250),
      level(14, 1_200, 2_400, 300),
    ],
  },
  "national-premier": {
    id: "national-premier",
    stageIds: ["national"],
    label: "全国プレミア",
    levelDurationMinutes: 12,
    breakEveryLevels: 4,
    breakDurationMinutes: 10,
    levels: [
      level(1, 50, 100),
      level(2, 75, 150),
      level(3, 100, 200, 25),
      level(4, 150, 300, 25),
      level(5, 200, 400, 50),
      level(6, 300, 600, 50),
      level(7, 400, 800, 75),
      level(8, 500, 1_000, 100),
      level(9, 600, 1_200, 150),
      level(10, 800, 1_600, 200),
      level(11, 1_000, 2_000, 250),
      level(12, 1_200, 2_400, 300),
      level(13, 1_500, 3_000, 400),
      level(14, 2_000, 4_000, 500),
      level(15, 3_000, 6_000, 500),
      level(16, 4_000, 8_000, 600),
    ],
  },
  "world-championship": {
    id: "world-championship",
    stageIds: ["world"],
    label: "世界選手権",
    levelDurationMinutes: 15,
    breakEveryLevels: 3,
    breakDurationMinutes: 12,
    levels: [
      level(1, 75, 150),
      level(2, 100, 200),
      level(3, 150, 300, 25),
      level(4, 200, 400, 25),
      level(5, 300, 600, 50),
      level(6, 400, 800, 50),
      level(7, 500, 1_000, 75),
      level(8, 600, 1_200, 100),
      level(9, 800, 1_600, 125),
      level(10, 1_000, 2_000, 150),
      level(11, 1_200, 2_400, 200),
      level(12, 1_500, 3_000, 250),
      level(13, 2_000, 4_000, 300),
      level(14, 2_500, 5_000, 400),
      level(15, 3_500, 7_000, 500),
      level(16, 5_000, 10_000, 750),
      level(17, 7_500, 15_000, 1_000),
      level(18, 10_000, 20_000, 1_500),
      level(19, 15_000, 30_000, 2_000),
      level(20, 20_000, 40_000, 3_000),
    ],
  },
};

export function getBlindSheetById(sheetId) {
  if (!sheetId) return null;
  return TOURNAMENT_BLIND_SHEETS[sheetId] ?? null;
}

export function getBlindSheetForStage(stageId) {
  if (!stageId) return null;
  const direct = getBlindSheetById(`${stageId}-standard`);
  if (direct) return direct;
  return (
    Object.values(TOURNAMENT_BLIND_SHEETS).find((sheet) =>
      Array.isArray(sheet.stageIds) && sheet.stageIds.includes(stageId)
    ) ?? null
  );
}
