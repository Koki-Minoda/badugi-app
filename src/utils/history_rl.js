const STORAGE_KEY = "rl_hand_histories_v1";
const HUMAN_BENCHMARK_STORAGE_KEY = "badugi_human_benchmark_logs_v1";
const MAX_RL_RECORDS = 200;
const MAX_HUMAN_BENCHMARK_RECORDS = 500;
const HUMAN_BENCHMARK_SCHEMA_VERSION = "human-benchmark-v1";

function getStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function readJsonlStorage(key) {
  try {
    const storage = getStorage();
    const data = storage?.getItem(key);
    if (!data) return [];
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.error(`[SAVE_RL] Failed to parse ${key}:`, e);
    return [];
  }
}

function appendJsonlStorage(key, record) {
  const storage = getStorage();
  if (!storage) return;
  const maxRecords = key === STORAGE_KEY ? MAX_RL_RECORDS : MAX_HUMAN_BENCHMARK_RECORDS;
  const line = JSON.stringify(record);
  const existing = storage.getItem(key) ?? "";
  const lines = existing ? existing.split("\n").filter(Boolean) : [];
  lines.push(line);
  const trimmed = lines.slice(-maxRecords).join("\n");
  try {
    storage.setItem(key, trimmed);
  } catch (e) {
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      const half = lines.slice(-Math.floor(maxRecords / 2)).join("\n");
      try {
        storage.setItem(key, half);
      } catch {
        /* skip silently */
      }
    }
  }
}

function normalizeVariantId(record) {
  return String(
    record?.variantId ??
      record?.gameId ??
      record?.variant?.id ??
      record?.humanBenchmark?.variantId ??
      "",
  ).toLowerCase();
}

function isBadugiRecord(record) {
  const variantId = normalizeVariantId(record);
  return variantId === "d03" || variantId === "badugi" || variantId.includes("badugi");
}

function resolveSeatNumber(value) {
  const seat = Number(value);
  return Number.isInteger(seat) && seat >= 0 ? seat : null;
}

function findSeatRecord(record, seatIndex) {
  const sources = [
    Array.isArray(record?.players) ? record.players : [],
    Array.isArray(record?.seats) ? record.seats : [],
    Array.isArray(record?.humanBenchmark?.players) ? record.humanBenchmark.players : [],
  ];
  for (const seats of sources) {
    const found = seats.find((seat) => resolveSeatNumber(seat?.seat) === seatIndex);
    if (found) return found;
    if (seats[seatIndex]) return seats[seatIndex];
  }
  return null;
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveSeatStacks(record, seatIndex) {
  const seat = findSeatRecord(record, seatIndex);
  const startStack =
    numericOrNull(seat?.startStack) ??
    numericOrNull(seat?.startingStack) ??
    numericOrNull(record?.startStacks?.[seatIndex]) ??
    numericOrNull(record?.humanBenchmark?.startStacks?.[seatIndex]);
  const endStack =
    numericOrNull(seat?.endStack) ??
    numericOrNull(seat?.stack) ??
    numericOrNull(record?.endStacks?.[seatIndex]) ??
    numericOrNull(record?.humanBenchmark?.endStacks?.[seatIndex]);
  return {
    startStack,
    endStack,
    net:
      startStack !== null && endStack !== null
        ? Math.round((endStack - startStack) * 1000) / 1000
        : null,
  };
}

function resultFromNet(net) {
  if (!Number.isFinite(net)) return null;
  if (net > 0) return "win";
  if (net < 0) return "loss";
  return "tie";
}

function resolveHeroResult(record, heroSeat, heroNet) {
  const explicit =
    record?.humanBenchmark?.heroResult ?? record?.heroResult ?? record?.result ?? record?.outcome;
  const normalized = String(explicit ?? "").toLowerCase();
  if (["win", "won", "1"].includes(normalized)) return "win";
  if (["loss", "lost", "-1"].includes(normalized)) return "loss";
  if (["tie", "push", "0"].includes(normalized)) return "tie";
  const fromNet = resultFromNet(heroNet);
  if (fromNet) return fromNet;

  const winners = Array.isArray(record?.winners) ? record.winners : [];
  const heroSeatRecord = findSeatRecord(record, heroSeat);
  const heroName = heroSeatRecord?.name;
  if (
    winners.some((winner) => {
      if (typeof winner === "string") return winner === heroName;
      return resolveSeatNumber(winner?.seat ?? winner?.seatIndex) === heroSeat;
    })
  ) {
    return "win";
  }
  return null;
}

function normalizeActions(record) {
  const flatActions = Array.isArray(record?.actions) ? record.actions : [];
  if (flatActions.length > 0) return flatActions;
  const seats = Array.isArray(record?.seats) ? record.seats : [];
  return seats.flatMap((seat) =>
    (Array.isArray(seat?.actions) ? seat.actions : []).map((action) => ({
      ...action,
      seat: resolveSeatNumber(action?.seat ?? seat?.seat),
    })),
  );
}

function normalizeOpponent(record, heroSeat, seat) {
  const seatIndex = resolveSeatNumber(seat?.seat);
  if (seatIndex === null || seatIndex === heroSeat) return null;
  const stacks = resolveSeatStacks(record, seatIndex);
  const cpuModel = seat?.cpuModel ?? seat?.model ?? {};
  return {
    seat: seatIndex,
    name: seat?.name ?? `CPU ${seatIndex + 1}`,
    isCPU: seat?.isCPU ?? seatIndex !== heroSeat,
    cpuTier: seat?.cpuTier ?? cpuModel?.tier ?? cpuModel?.tierId ?? null,
    cpuModelId: seat?.cpuModelId ?? cpuModel?.id ?? cpuModel?.modelId ?? null,
    cpuModelVersion: seat?.cpuModelVersion ?? cpuModel?.version ?? null,
    featureSet: seat?.featureSet ?? cpuModel?.featureSet ?? null,
    trainingRun: seat?.trainingRun ?? cpuModel?.trainingRun ?? null,
    trainingCheckpoint: seat?.trainingCheckpoint ?? cpuModel?.trainingCheckpoint ?? null,
    startStack: stacks.startStack,
    endStack: stacks.endStack,
    net: stacks.net,
  };
}

export function buildHumanBenchmarkLog(record, options = {}) {
  if (!record || typeof record !== "object") return null;
  if (!options.force && !isBadugiRecord(record)) return null;
  const heroSeat = resolveSeatNumber(options.heroSeat ?? record?.humanBenchmark?.heroSeat ?? record?.heroSeat) ?? 0;
  const heroStacks = resolveSeatStacks(record, heroSeat);
  const heroNet =
    numericOrNull(record?.humanBenchmark?.heroNet) ??
    numericOrNull(record?.heroNet) ??
    heroStacks.net;
  const heroResult = resolveHeroResult(record, heroSeat, heroNet);
  if (!heroResult && heroNet === null) return null;

  const playerSeats = Array.isArray(record?.players) ? record.players : [];
  const opponents = playerSeats
    .map((seat) => normalizeOpponent(record, heroSeat, seat))
    .filter(Boolean);

  return {
    schemaVersion: HUMAN_BENCHMARK_SCHEMA_VERSION,
    source: record?.humanBenchmark?.source ?? options.source ?? "cash-game",
    handId: record?.handId ?? record?.hand_id ?? record?.id ?? null,
    ts: record?.ts ?? record?.timestamp ?? Date.now(),
    variantId: record?.variantId ?? record?.gameId ?? record?.humanBenchmark?.variantId ?? null,
    variantName: record?.variantName ?? record?.humanBenchmark?.variantName ?? null,
    tableId: record?.tableId ?? null,
    tableSize: numericOrNull(record?.tableSize) ?? playerSeats.length,
    heroSeat,
    heroName: findSeatRecord(record, heroSeat)?.name ?? "You",
    heroStartStack: heroStacks.startStack,
    heroEndStack: heroStacks.endStack,
    heroNet,
    heroResult,
    pot: numericOrNull(record?.pot),
    cpuTier: opponents[0]?.cpuTier ?? record?.humanBenchmark?.cpuTier ?? null,
    cpuModelId: opponents[0]?.cpuModelId ?? record?.humanBenchmark?.cpuModelId ?? null,
    cpuModelVersion: opponents[0]?.cpuModelVersion ?? record?.humanBenchmark?.cpuModelVersion ?? null,
    featureSet: opponents[0]?.featureSet ?? record?.humanBenchmark?.featureSet ?? null,
    trainingRun: opponents[0]?.trainingRun ?? record?.humanBenchmark?.trainingRun ?? null,
    trainingCheckpoint:
      opponents[0]?.trainingCheckpoint ?? record?.humanBenchmark?.trainingCheckpoint ?? null,
    opponents,
    actions: normalizeActions(record),
    showdown: record?.showdown ?? null,
    winners: record?.winners ?? null,
    winner: record?.winner ?? null,
  };
}

export function saveHumanBenchmarkLog(record, options = {}) {
  try {
    const humanLog = buildHumanBenchmarkLog(record, options);
    if (!humanLog) return null;
    appendJsonlStorage(HUMAN_BENCHMARK_STORAGE_KEY, humanLog);
    console.log("[HUMAN_BENCHMARK] appended record", {
      handId: humanLog.handId,
      variantId: humanLog.variantId,
      heroResult: humanLog.heroResult,
      heroNet: humanLog.heroNet,
      cpuModelId: humanLog.cpuModelId,
    });
    return humanLog;
  } catch (e) {
    console.error("[HUMAN_BENCHMARK] failed to save:", e);
    return null;
  }
}

export function saveRLHandHistory(record) {
  try {
    appendJsonlStorage(STORAGE_KEY, record);
    saveHumanBenchmarkLog(record);
    const pots = Array.isArray(record?.pots) ? record.pots : [];
    const winners = pots.flatMap((pot) =>
      Array.isArray(pot?.winners)
        ? pot.winners.map((winner) => ({
            seat: winner.seat ?? winner.seatIndex ?? null,
            collect: winner.collect ?? winner.payout ?? 0,
            handLabel: winner.handLabel ?? winner.handName ?? null,
            finalLowRanks: winner.finalLowRanks ?? winner.evaluation?.metadata?.ranks ?? null,
          }))
        : [],
    );
    console.log("[SAVE_RL] appended record", {
      handId: record?.handId ?? record?.hand_id ?? record?.id ?? null,
      variantId: record?.variantId ?? record?.gameId ?? null,
      winner: record?.winner ?? null,
      winners,
      pot: record?.pot ?? pots.reduce((sum, pot) => sum + (pot?.amount ?? 0), 0),
    });
  } catch (e) {
    console.error("[SAVE_RL] failed to save:", e);
  }
}

export function getAllRLHandHistories() {
  return readJsonlStorage(STORAGE_KEY);
}

export function getHumanBenchmarkLogs() {
  return readJsonlStorage(HUMAN_BENCHMARK_STORAGE_KEY);
}

export function clearHumanBenchmarkLogs() {
  try {
    getStorage()?.removeItem(HUMAN_BENCHMARK_STORAGE_KEY);
  } catch (e) {
    console.error("[HUMAN_BENCHMARK] clear failed:", e);
  }
}

export function exportRLHistoryAsJSONL() {
  try {
    const payload = getStorage()?.getItem(STORAGE_KEY) ?? "";
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `badugi_rl_${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    const lineCount = payload ? payload.split("\n").filter(Boolean).length : 0;
    console.log(`[SAVE_RL] exported ${lineCount} records as JSONL`);
  } catch (e) {
    console.error("[SAVE_RL] export failed:", e);
  }
}

export function exportHumanBenchmarkLogsAsJSONL() {
  try {
    const payload = getStorage()?.getItem(HUMAN_BENCHMARK_STORAGE_KEY) ?? "";
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `badugi_human_benchmark_${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    const lineCount = payload ? payload.split("\n").filter(Boolean).length : 0;
    console.log(`[HUMAN_BENCHMARK] exported ${lineCount} records as JSONL`);
  } catch (e) {
    console.error("[HUMAN_BENCHMARK] export failed:", e);
  }
}

export function installHumanBenchmarkLogDevTools() {
  if (typeof window === "undefined") return;
  window.MGX = window.MGX ?? {};
  window.MGX.getHumanBenchmarkLogs = getHumanBenchmarkLogs;
  window.MGX.exportHumanBenchmarkLogs = exportHumanBenchmarkLogsAsJSONL;
  window.MGX.clearHumanBenchmarkLogs = clearHumanBenchmarkLogs;
}
