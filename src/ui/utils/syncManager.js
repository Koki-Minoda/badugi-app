import { normalizeTokenType } from "./auth.js";

const STORAGE_KEY = "sync.queue.v1";
const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;

let flushing = false;
let timer = null;
let authBlockedToken = null;
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function loadQueue() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[sync] failed to load queue", err);
    return [];
  }
}

function saveQueue(queue) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("[sync] failed to persist queue", err);
  }
}

function authHeaders(accessToken, tokenType) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    const scheme = normalizeTokenType(tokenType);
    headers.Authorization = `${scheme} ${accessToken}`;
  }
  return headers;
}

function buildApiBaseUrl() {
  if (ABSOLUTE_URL_REGEX.test(API_BASE)) return API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${API_BASE}`;
  }
  return API_BASE;
}

function enqueueJob(type, payload) {
  const queue = loadQueue();
  queue.push({ id: `${type}-${Date.now()}`, type, payload, ts: Date.now() });
  saveQueue(queue);
}

async function postJson(path, body, options = {}) {
  const res = await fetch(`${buildApiBaseUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(options.accessToken, options.tokenType),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`sync failed ${res.status}: ${text}`);
    error.status = res.status;
    error.body = text;
    throw error;
  }
  return res.json();
}

export async function fetchSeatStats({
  playerId,
  accessToken,
  tokenType,
  limitHands = 200,
} = {}) {
  if (!playerId) return null;
  if (!accessToken || authBlockedToken === accessToken) return null;
  const baseUrl = buildApiBaseUrl();
  if (!baseUrl) return null;
  const params = new URLSearchParams({
    player_id: playerId,
    limit_hands: String(limitHands),
  });
  try {
    const res = await fetch(`${baseUrl}/badugi/stats?${params.toString()}`, {
      headers: authHeaders(accessToken, tokenType),
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  } catch (err) {
    console.warn("[sync] fetchSeatStats failed", err);
    return null;
  }
}

function normalizeHandLogPayload(payload) {
  const record = payload?.data ?? payload ?? {};
  const handId = record.handId ?? record.hand_id ?? record.id ?? null;
  if (!handId) {
    console.warn("[sync] hand-history missing handId", record);
    return null;
  }
  const createdAt =
    record.created_at ??
    (Number.isFinite(record.endedAt) ? new Date(record.endedAt).toISOString() : null) ??
    (Number.isFinite(record.startedAt) ? new Date(record.startedAt).toISOString() : null) ??
    (Number.isFinite(record.ts) ? new Date(record.ts).toISOString() : new Date().toISOString());
  const seats = Array.isArray(record.seats) ? record.seats : [];
  const pots = Array.isArray(record.pots) ? record.pots : [];
  const winners = [
    ...new Set(
      pots
        .flatMap((pot) => (Array.isArray(pot?.winners) ? pot.winners : []))
        .map((winner) =>
          typeof winner?.seat === "number"
            ? winner.seat
            : typeof winner?.seatIndex === "number"
            ? winner.seatIndex
            : null,
        )
        .filter((seat) => seat !== null),
    ),
  ];
  const pot = pots.reduce((sum, potEntry) => sum + (potEntry?.amount ?? 0), 0);
  // Example: seats=[...], pots=[{amount:50,winners:[{seat:1,collect:50}]}] -> winners=[1], pot=50.
  const actions = seats.flatMap((seatEntry) => {
    const seatIndex = seatEntry?.seat ?? seatEntry?.seatIndex;
    if (!Number.isFinite(seatIndex)) {
      console.warn("[sync] hand-history action missing seatIndex", seatEntry);
      return [];
    }
    const playerId =
      seatEntry?.player_id ??
      seatEntry?.playerId ??
      seatEntry?.name ??
      `seat-${seatIndex}`;
    const seatActions = Array.isArray(seatEntry?.actions) ? seatEntry.actions : [];
    return seatActions.map((entry) => ({
      seat_index: seatIndex,
      player_id: playerId,
      action: entry?.type ?? entry?.action ?? "action",
      amount: Number.isFinite(entry?.amount) ? entry.amount : null,
      round: Number.isFinite(entry?.round) ? entry.round : 0,
      seq: Number.isFinite(entry?.seq) ? entry.seq : null,
      phase: entry?.street ?? entry?.phase ?? "BET",
      ts: entry?.timestamp ?? entry?.ts ?? null,
      meta: entry?.metadata ?? null,
    }));
  });
  const results = seats.reduce((acc, seatEntry) => {
    const seatIndex = seatEntry?.seat ?? seatEntry?.seatIndex;
    if (!Number.isFinite(seatIndex)) {
      console.warn("[sync] hand-history result missing seatIndex", seatEntry);
      return acc;
    }
    const playerId =
      seatEntry?.player_id ??
      seatEntry?.playerId ??
      seatEntry?.name ??
      `seat-${seatIndex}`;
    const collected = pots.reduce((sum, potEntry) => {
      const payouts = Array.isArray(potEntry?.winners) ? potEntry.winners : [];
      const seatTotal = payouts.reduce((acc, payout) => {
        const winnerSeat =
          typeof payout?.seat === "number"
            ? payout.seat
            : typeof payout?.seatIndex === "number"
            ? payout.seatIndex
            : null;
        if (winnerSeat !== seatIndex) return acc;
        return acc + (payout?.collect ?? 0);
      }, 0);
      return sum + seatTotal;
    }, 0);
    acc.push({
      seat_index: seatIndex,
      player_id: playerId,
      final_stack: Number.isFinite(seatEntry?.endStack) ? seatEntry.endStack : 0,
      hand_label: seatEntry?.evaluation?.label ?? null,
      is_winner: winners.includes(seatIndex),
      pot_share: collected,
    });
    return acc;
  }, []);
  const metadata = {
    source: "syncManager",
    gameId: record.gameId ?? record.variantId ?? null,
    tableSize: record.tableSize ?? null,
    pot,
    winners,
    winner: record.winner ?? null,
  };
  return {
    hand_id: handId,
    table_id: record.tableId ?? record.table_id ?? null,
    tournament_id: record.tournamentId ?? record.tournament_id ?? null,
    level: Number.isFinite(record.level) ? record.level : null,
    created_at: createdAt,
    actions,
    results,
    metadata,
  };
}

function normalizeTournamentSavePayload(payload) {
  if (payload?.snapshot) return payload;
  return { snapshot: payload };
}

function normalizeActionLogPayload(actions = []) {
  const list = Array.isArray(actions) ? actions : [];
  return list
    .map((entry) => {
      if (!entry) return null;
      const ts =
        Number.isFinite(entry.ts) ? new Date(entry.ts).toISOString() : entry.ts ?? null;
      return {
        hand_id: entry.handId ?? entry.hand_id ?? null,
        player_id: entry.playerId ?? entry.player_id ?? null,
        seat_index: Number.isFinite(entry.seat) ? entry.seat : entry.seat_index ?? null,
        phase: entry.phase ?? "BET",
        round: Number.isFinite(entry.round) ? entry.round : 0,
        action: entry.action ?? "action",
        action_type: entry.actionType ?? entry.action_type ?? null,
        paid: Number.isFinite(entry.paid) ? entry.paid : 0,
        to_call: Number.isFinite(entry.toCall) ? entry.toCall : entry.to_call ?? null,
        is_forced: Boolean(entry.isForced ?? entry.is_forced ?? false),
        stack_before:
          Number.isFinite(entry.stackBefore) ? entry.stackBefore : entry.stack_before ?? null,
        stack_after:
          Number.isFinite(entry.stackAfter) ? entry.stackAfter : entry.stack_after ?? null,
        bet_before:
          Number.isFinite(entry.betBefore) ? entry.betBefore : entry.bet_before ?? null,
        bet_after: Number.isFinite(entry.betAfter) ? entry.betAfter : entry.bet_after ?? null,
        seq: Number.isFinite(entry.seq) ? entry.seq : null,
        ts,
        metadata: entry.metadata ?? null,
      };
    })
    .filter(Boolean);
}

async function sendJob(job, options = {}) {
  switch (job.type) {
    case "hand-history":
      {
        const payload = normalizeHandLogPayload(job.payload);
        if (!payload) return;
        await postJson("/badugi/hands", payload, options);
      }
      break;
    case "badugi.actions":
      {
        const payload = normalizeActionLogPayload(job.payload?.actions ?? job.payload ?? []);
        if (!payload.length) return;
        await postJson("/badugi/actions/batch", { actions: payload }, options);
      }
      break;
    case "rating-update":
      console.warn("[sync] rating-update skipped (backend not wired yet)");
      break;
    case "tournament-snapshot":
      {
        const payload = normalizeTournamentSavePayload(job.payload);
        await postJson("/tournament/save", payload, options);
      }
      break;
    case "rl-buffer":
      console.warn("[sync] rl-buffer skipped (backend not wired yet)");
      break;
    default:
      console.warn("[sync] unknown job type", job.type);
  }
}

export async function flushQueue(options = {}) {
  if (flushing) return;
  if (!options.accessToken) return;
  if (authBlockedToken === options.accessToken) return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  flushing = true;
  const remaining = [];
  for (let index = 0; index < queue.length; index += 1) {
    const job = queue[index];
    try {
      await sendJob(job, options);
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        authBlockedToken = options.accessToken;
        console.warn("[sync] authentication failed; queue retained until next login", {
          status: err.status,
          jobType: job.type,
        });
        remaining.push(job, ...queue.slice(index + 1));
        break;
      }
      console.warn("[sync] job failed", job.type, err);
      remaining.push(job, ...queue.slice(index + 1));
      break;
    }
  }
  saveQueue(remaining);
  flushing = false;
}

// startAutoSync must be called with the latest JWT (if available). The caller
// is responsible for stopping the returned cleanup function when the token
// changes or the component unmounts.
export function startAutoSync(intervalMs = 30000, options = {}) {
  if (typeof window === "undefined") {
    return () => {};
  }
  flushQueue(options).catch((err) => {
    console.warn("[sync] auto flush failed", err);
  });
  const onlineHandler = () => {
    flushQueue(options).catch((err) => {
      console.warn("[sync] auto flush (online) failed", err);
    });
  };
  window.addEventListener("online", onlineHandler);
  timer = window.setInterval(() => {
    flushQueue(options).catch((err) => {
      console.warn("[sync] scheduled flush failed", err);
    });
  }, intervalMs);
  return () => {
    window.removeEventListener("online", onlineHandler);
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function enqueueHandRecord(record, options = {}) {
  enqueueJob("hand-history", {
    handId: record.handId,
    winner: record.winner,
    variantId: record.gameId,
    data: record,
  });
  if (options.flushNow && import.meta.env?.DEV) {
    flushQueue(options).catch((err) => {
      console.warn("[sync] flushNow failed", err);
    });
  }
}

export function enqueueBadugiActions(actions, options = {}) {
  enqueueJob("badugi.actions", { actions });
  if (options.flushNow && import.meta.env?.DEV) {
    flushQueue(options).catch((err) => {
      console.warn("[sync] flushNow failed", err);
    });
  }
}

export function enqueueRatingUpdate(payload) {
  enqueueJob("rating-update", payload);
}

export function enqueueTournamentSnapshot(snapshot) {
  enqueueJob("tournament-snapshot", snapshot);
}

export function enqueueRlBuffer(entry) {
  enqueueJob("rl-buffer", entry);
}
