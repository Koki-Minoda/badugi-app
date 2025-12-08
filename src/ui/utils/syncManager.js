const STORAGE_KEY = "sync.queue.v1";
const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

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

function authHeaders(accessToken) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function enqueueJob(type, payload) {
  const queue = loadQueue();
  queue.push({ id: `${type}-${Date.now()}`, type, payload, ts: Date.now() });
  saveQueue(queue);
}

async function postJson(path, body, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(options.accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sync failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function sendJob(job, options = {}) {
  switch (job.type) {
    case "hand-history":
      await postJson("/history/hand", job.payload, options);
      break;
    case "rating-update":
      await postJson("/rating/update", job.payload, options);
      break;
    case "tournament-snapshot":
      await postJson("/tournament/snapshot", job.payload, options);
      break;
    case "rl-buffer":
      await postJson("/ai/rl/buffer", job.payload, options);
      break;
    default:
      console.warn("[sync] unknown job type", job.type);
  }
}

export async function flushQueue(options = {}) {
  if (flushing) return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  flushing = true;
  const remaining = [];
  for (const job of queue) {
    try {
      await sendJob(job, options);
    } catch (err) {
      console.warn("[sync] job failed", job.type, err);
      remaining.push(job);
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
