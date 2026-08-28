const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;
const AUTH_STORAGE_KEY = "mgx_auth";
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function buildApiBaseUrl() {
  if (ABSOLUTE_URL_REGEX.test(API_BASE)) return API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${API_BASE}`;
  }
  return API_BASE;
}

export function readRoomAuth() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    if (!parsed?.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      tokenType:
        String(parsed.tokenType ?? "Bearer").toLowerCase() === "bearer"
          ? "Bearer"
          : parsed.tokenType,
      user: parsed.user ?? null,
    };
  } catch {
    return null;
  }
}

function normalizeRoom(data) {
  if (!data) return data;
  return {
    ...data,
    roomId: data.roomCode ?? data.roomId,
    ownerId: data.viewerId ?? data.ownerId,
    displayName:
      data.players?.find((player) => player.id === data.viewerId)?.displayName ??
      readRoomAuth()?.user?.username ??
      "Player",
    metadata: {
      variantId: data.variantId ?? "badugi",
      ...(data.config ?? {}),
    },
  };
}

function parseRetryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const deadline = Date.parse(value);
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, deadline - Date.now());
}

export class RoomApiError extends Error {
  constructor(message, { status = 0, code = null, retryAfterMs = null } = {}) {
    super(message);
    this.name = "RoomApiError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.terminalCode =
      status === 401 || status === 403
        ? 4401
        : status === 404 || code === "room_missing"
          ? 4004
          : null;
  }
}

async function requestJson(path, { method = "GET", body, signal } = {}) {
  const auth = readRoomAuth();
  if (!auth?.accessToken) {
    throw new RoomApiError("login_required", { status: 401, code: "login_required" });
  }
  const response = await fetch(`${buildApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `${auth.tokenType ?? "Bearer"} ${auth.accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = detail?.message ?? detail ?? data?.message ?? data?.error ?? response.statusText;
    throw new RoomApiError(
      typeof message === "string" ? message : JSON.stringify(message),
      {
        status: response.status,
        code: detail?.code ?? data?.code ?? null,
        retryAfterMs: parseRetryAfterMs(response.headers.get("Retry-After")),
      },
    );
  }
  return normalizeRoom(data?.data ?? data);
}

export async function createRoom({ metadata = {} }) {
  return requestJson("/p2p/rooms", {
    method: "POST",
    body: {
      variantId: metadata.variantId ?? "badugi",
      startingStack: Number(metadata.startingStack ?? 2000),
      smallBlind: Number(metadata.smallBlind ?? 10),
      bigBlind: Number(metadata.bigBlind ?? 20),
      ante: Number(metadata.ante ?? 0),
    },
  });
}

export async function joinRoom({ roomId }) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson("/p2p/rooms/join", {
    method: "POST",
    body: { roomCode: roomId.trim().toUpperCase() },
  });
}

export async function getRoomInfo(roomId) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}`);
}

export async function getRoomState(roomId, { signal } = {}) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/state`, {
    signal,
  });
}

export async function readyRoom(roomId, command, { signal } = {}) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/ready`, {
    method: "POST",
    body: command,
    signal,
  });
}

export async function actInRoom(roomId, command, { signal } = {}) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/action`, {
    method: "POST",
    body: command,
    signal,
  });
}

export async function drawInRoom(roomId, command, { signal } = {}) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/draw`, {
    method: "POST",
    body: command,
    signal,
  });
}

export async function leaveRoom(roomId) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson("/p2p/rooms/leave", {
    method: "POST",
    body: { roomCode: roomId.trim().toUpperCase() },
  });
}

export async function closeRoom(roomId) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/p2p/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}`, {
    method: "DELETE",
  });
}

export function buildRoomWebSocketUrl(roomId) {
  if (!roomId) return null;
  if (typeof window === "undefined" || !window.location) {
    return `/ws/p2p/${encodeURIComponent(roomId)}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/p2p/${encodeURIComponent(roomId)}`;
}

export function buildRoomWebSocketProtocols() {
  const token = readRoomAuth()?.accessToken;
  return token ? ["mgx-auth", token] : [];
}
