const STORAGE_KEY = "sync.queue.v1";
const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://127.0.0.1:8000/api";
const DEFAULT_TOKEN = "demo-token";

let flushing = false;
let timer = null;

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

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DEFAULT_TOKEN}`,
  };
}

function enqueueJob(type, payload) {
  const queue = loadQueue();
  queue.push({ id: `${type}-${Date.now()}`, type, payload, ts: Date.now() });
  saveQueue(queue);
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sync failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function sendJob(job) {
  switch (job.type) {
    case "hand-history":
      await postJson("/history/hand", job.payload);
      break;
    case "rating-update":
      await postJson("/rating/update", job.payload);
      break;
    case "tournament-snapshot":
      await postJson("/tournament/snapshot", job.payload);
      break;
    case "rl-buffer":
      await postJson("/ai/rl/buffer", job.payload);
      break;
    default:
      console.warn("[sync] unknown job type", job.type);
  }
}

export async function flushQueue() {
  if (flushing) return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  flushing = true;
  const remaining = [];
  for (const job of queue) {
    try {
      await sendJob(job);
    } catch (err) {
      console.warn("[sync] job failed", job.type, err);
      remaining.push(job);
      break;
    }
  }
  saveQueue(remaining);
  flushing = false;
}

export function startAutoSync(intervalMs = 30000) {
  if (typeof window === "undefined") {
    return () => {};
  }
  flushQueue();
  const onlineHandler = () => flushQueue();
  window.addEventListener("online", onlineHandler);
  timer = window.setInterval(flushQueue, intervalMs);
  return () => {
    window.removeEventListener("online", onlineHandler);
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function enqueueHandRecord(record) {
  enqueueJob("hand-history", {
    handId: record.handId,
    winner: record.winner,
    variantId: record.gameId,
    data: record,
  });
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
