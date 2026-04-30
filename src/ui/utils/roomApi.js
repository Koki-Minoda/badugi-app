const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function buildApiBaseUrl() {
  if (ABSOLUTE_URL_REGEX.test(API_BASE)) return API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${API_BASE}`;
  }
  return API_BASE;
}

async function requestJson(path, { method = "GET", body } = {}) {
  const response = await fetch(`${buildApiBaseUrl()}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail ?? data?.message ?? data?.error ?? response.statusText;
    throw new Error(`Room API failed ${response.status}: ${detail}`);
  }
  return data?.data ?? data;
}

export async function createRoom({ ownerId, maxPlayers = 2, mode = "ring", metadata = {} }) {
  if (!ownerId) throw new Error("ownerId is required");
  return requestJson("/rooms/create", {
    method: "POST",
    body: {
      owner_id: ownerId,
      max_players: maxPlayers,
      mode,
      metadata,
    },
  });
}

export async function joinRoom({
  roomId,
  playerId,
  displayName,
  seatHint = null,
  role = "player",
}) {
  if (!roomId) throw new Error("roomId is required");
  if (!playerId) throw new Error("playerId is required");
  return requestJson("/rooms/join", {
    method: "POST",
    body: {
      room_id: roomId,
      player_id: playerId,
      display_name: displayName ?? playerId,
      seat_hint: seatHint,
      role,
    },
  });
}

export async function getRoomInfo(roomId) {
  if (!roomId) throw new Error("roomId is required");
  return requestJson(`/rooms/info/${encodeURIComponent(roomId)}`);
}

export async function listRooms() {
  return requestJson("/rooms/list");
}

export function buildRoomWebSocketUrl(roomId) {
  if (!roomId) return null;
  if (typeof window === "undefined" || !window.location) {
    return `/ws/room/${encodeURIComponent(roomId)}/play`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/room/${encodeURIComponent(roomId)}/play`;
}
