import { getStageById } from "../../config/tournamentStages";
import { TOURNAMENT_OPPONENTS } from "../../config/tournamentOpponents";
import { disableDealerChoiceMode } from "../dealersChoice/dealerChoiceManager.js";

const SESSION_KEY = "session.tournament.active";
export const ACTIVE_TOURNAMENT_SESSION_KEY = SESSION_KEY;

function randomId(prefix = "session") {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const salt = Math.floor(Math.random() * 10_000);
  return `${prefix}-${Date.now()}-${salt}`;
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const fallbackNames = [
  "Atlas",
  "Breeze",
  "Cipher",
  "Delta",
  "Echo",
  "Fjord",
  "Glint",
  "Hawk",
  "Iris",
  "Joker",
  "Kite",
  "Lumen",
  "Muse",
  "Nova",
  "Orion",
  "Pulse",
  "Quartz",
  "Rune",
  "Saber",
  "Titan",
  "Umber",
  "Vivid",
  "Wyvern",
  "Xeno",
  "Ymir",
  "Zephyr",
];

function createGenericOpponent(stageId, idx, difficulty = 1) {
  const baseName = fallbackNames[idx % fallbackNames.length];
  const tierLabel = { store: "店舗", local: "地方", national: "全国", world: "世界" }[stageId] ?? "店舗";
  const strength = Math.min(5, Math.max(1, difficulty + (idx % 3)));
  return {
    id: `${stageId}-generic-${idx}`,
    stageId,
    tier: tierLabel,
    name: `${baseName}-${idx + 1}`,
    nickname: "Generic",
    style: strength >= 4 ? "Aggro" : strength <= 2 ? "Loose" : "Balanced",
    strength,
    aggression: Math.min(0.85, 0.35 + strength * 0.08),
    tightness: Math.min(0.85, 0.4 + strength * 0.07),
    drawRate: 0.32 + strength * 0.02,
    bluffFreq: 0.08 + strength * 0.02,
    notes: "Auto-generated opponent",
  };
}

function buildOpponentPool(stageId, totalNeeded) {
  const exactMatches = TOURNAMENT_OPPONENTS.filter((opp) => opp.stageId === stageId);
  const allied = TOURNAMENT_OPPONENTS.filter((opp) => opp.stageId !== stageId);
  const pool = [...exactMatches];
  let idx = 0;
  while (pool.length < totalNeeded && idx < allied.length) {
    pool.push(allied[idx]);
    idx += 1;
  }
  while (pool.length < totalNeeded) {
    pool.push(createGenericOpponent(stageId, pool.length, 2));
  }
  return pool.slice(0, totalNeeded);
}

function getSeatMap(session) {
  const map = new Map();
  (session?.seats ?? []).forEach((seat) => map.set(seat.participantId, seat));
  return map;
}

function ensureTableAssignments(session) {
  if (!session) return session;
  session.tableAssignments = Array.isArray(session.tableAssignments) ? [...session.tableAssignments] : [];
  session.waitingQueue = Array.isArray(session.waitingQueue) ? [...session.waitingQueue] : [];

  const stage = getStageById(session.stageId);
  const tableSize = stage?.tableSize ?? 6;
  const aliveSeats = (session.seats ?? []).filter((seat) => seat.status !== "busted");
  const aliveIds = aliveSeats.map((seat) => seat.participantId);
  const aliveSet = new Set(aliveIds);

  session.tableAssignments = session.tableAssignments.filter((id) => aliveSet.has(id));
  if (aliveSet.has("hero")) {
    session.tableAssignments = session.tableAssignments.filter((id) => id !== "hero");
    session.tableAssignments.unshift("hero");
  }

  const currentSet = new Set(session.tableAssignments);
  session.waitingQueue = session.waitingQueue.filter((id) => aliveSet.has(id) && !currentSet.has(id));
  aliveIds.forEach((id) => {
    if (id !== "hero" && !currentSet.has(id) && !session.waitingQueue.includes(id)) {
      session.waitingQueue.push(id);
    }
  });

  const desiredSeats = Math.min(tableSize, aliveIds.length);
  while (session.tableAssignments.length < desiredSeats) {
    const nextId = session.waitingQueue.shift();
    if (!nextId) break;
    if (currentSet.has(nextId)) continue;
    session.tableAssignments.push(nextId);
    currentSet.add(nextId);
  }

  session.tableAssignments = session.tableAssignments.slice(0, desiredSeats);
  return session;
}

export function saveActiveTournamentSession(session) {
  if (!hasStorage()) return session;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadActiveTournamentSession() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to load tournament session:", err);
    return null;
  }
}

export function clearActiveTournamentSession() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function createTournamentSession(stageId, heroProfile) {
  const stage = getStageById(stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  disableDealerChoiceMode("tournament");

  const totalEntrants = randomInt(stage.participantsRange[0], stage.participantsRange[1]);
  const cpuNeeded = Math.max(0, totalEntrants - 1);
  const opponents = buildOpponentPool(stageId, cpuNeeded);

  const seats = [
    {
      participantId: "hero",
      seatType: "HUMAN",
      name: heroProfile?.name ?? "You",
      titleBadge: heroProfile?.titleBadge ?? "",
      avatar: heroProfile?.avatar ?? "default",
      stack: stage.startingStack,
      status: "alive",
    },
    ...opponents.map((opp) => ({
      participantId: opp.id,
      seatType: "CPU",
      name: opp.name,
      nickname: opp.nickname,
      style: opp.style,
      strength: opp.strength,
      stack: stage.startingStack,
      aggression: opp.aggression,
      tightness: opp.tightness,
      drawRate: opp.drawRate,
      bluffFreq: opp.bluffFreq,
      tier: opp.tier,
      status: "alive",
    })),
  ];

  const tableAssignments = [];
  const waitingQueue = [];
  seats.forEach((seat, idx) => {
    if (idx < stage.tableSize) {
      tableAssignments.push(seat.participantId);
    } else {
      waitingQueue.push(seat.participantId);
    }
  });

  const session = {
    id: randomId("tournament"),
    stageId: stage.id,
    stageLabel: stage.label,
    blindSheetId: stage.blindSheetId,
    entryFee: stage.entryFee,
    startingStack: stage.startingStack,
    totalEntrants,
    remainingPlayers: totalEntrants,
    seats,
    tableAssignments,
    waitingQueue,
    createdAt: Date.now(),
    prizeTable: stage.prizeTable,
    tableSize: stage.tableSize,
    status: "active",
  };

  return saveActiveTournamentSession(session);
}

export function simulateExternalBusts(session) {
  if (!session) return session;
  const stage = getStageById(session.stageId);
  if (!stage) return session;
  const tableSize = stage.tableSize ?? 6;
  if (session.remainingPlayers <= tableSize) return session;

  const maxDrop = Math.min(
    session.remainingPlayers - tableSize,
    Math.max(1, stage.difficulty ?? 1) * 2
  );
  const drop = randomInt(0, Math.max(1, maxDrop));
  if (drop <= 0) return session;

  const idleCandidates = session.seats
    ?.filter((seat) => seat.status !== "busted" && !session.tableAssignments?.includes(seat.participantId))
    .map((seat) => seat.participantId) ?? [];

  for (let i = 0; i < drop && idleCandidates.length; i += 1) {
    const pickIndex = Math.floor(Math.random() * idleCandidates.length);
    const pickedId = idleCandidates.splice(pickIndex, 1)[0];
    const pickedSeat = session.seats.find((seat) => seat.participantId === pickedId);
    if (pickedSeat) {
      pickedSeat.status = "busted";
      pickedSeat.stack = 0;
    }
  }

  session.remainingPlayers = session.seats.filter((seat) => seat.status !== "busted").length;
  ensureTableAssignments(session);
  return saveActiveTournamentSession(session);
}

export function syncSessionWithPlayers(players, sessionOverride = null) {
  const session = sessionOverride ?? loadActiveTournamentSession();
  if (!session || session.status !== "active") return session;

  const seatMap = getSeatMap(session);
  (session.tableAssignments ?? []).forEach((participantId, seatIdx) => {
    const player = players?.[seatIdx];
    const seatMeta = seatMap.get(participantId);
    if (!player || !seatMeta) return;
    const isBusted = Boolean(player.seatOut || player.isBusted || player.stack <= 0);
    seatMeta.stack = Math.max(0, player.stack ?? seatMeta.stack ?? 0);
    seatMeta.status = isBusted ? "busted" : "alive";
  });

  session.remainingPlayers = session.seats.filter((seat) => seat.status !== "busted").length;
  ensureTableAssignments(session);
  return saveActiveTournamentSession(session);
}

export function getPrizeForPlacement(stageId, placement) {
  const stage = getStageById(stageId);
  if (!stage) return 0;
  for (const tier of stage.prizeTable) {
    const [from, to] = tier.places;
    if (placement >= from && placement <= to) {
      return tier.payout;
    }
  }
  return 0;
}

export function finalizeSessionResult({ placement, prize = 0, reason, feedback }) {
  const session = loadActiveTournamentSession();
  if (!session) return null;
  session.status = "finished";
  session.result = {
    placement,
    prize,
    reason,
    feedback,
    finishedAt: Date.now(),
  };
  saveActiveTournamentSession(session);
  return session;
}

export function persistMixedGameState(state) {
  const session = loadActiveTournamentSession();
  if (!session) return null;
  if (!state) {
    delete session.mixedState;
  } else {
    session.mixedState = {
      ...session.mixedState,
      ...state,
      updatedAt: Date.now(),
    };
  }
  return saveActiveTournamentSession(session);
}

export function loadMixedGameStateFromSession() {
  const session = loadActiveTournamentSession();
  return session?.mixedState ?? null;
}
