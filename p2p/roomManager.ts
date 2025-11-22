export interface Participant {
  id: string;
  displayName: string;
  seat?: string;
  role?: "player" | "spectator";
  version?: number;
}

interface RoomState {
  id: string;
  players: Participant[];
  spectators: Participant[];
  maxPlayers: number;
  createdAt: number;
  metadata: Record<string, unknown>;
}

const rooms: Map<string, RoomState> = new Map();
const waitingPlayers: Participant[] = [];

function createRoom(id: string, maxPlayers = 6, metadata: Record<string, unknown> = {}) {
  if (rooms.has(id)) throw new Error(`Room ${id} already exists`);
  const room: RoomState = {
    id,
    players: [],
    spectators: [],
    maxPlayers,
    createdAt: Date.now(),
    metadata: { ...metadata },
  };
  rooms.set(id, room);
  return room;
}

function listRooms() {
  return Array.from(rooms.values());
}

function joinRoom(roomId: string, user: Participant) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);
  if (room.players.some((p) => p.id === user.id)) return room;
  if (room.players.length >= room.maxPlayers) {
    waitInQueue(user);
    throw new Error("Room full");
  }
  room.players.push({ ...user, role: "player" });
  return room;
}

function leaveRoom(roomId: string, userId: string) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== userId);
  room.spectators = room.spectators.filter((p) => p.id !== userId);
  if (!room.players.length && !room.spectators.length) {
    rooms.delete(roomId);
  }
  return room;
}

function addSpectator(roomId: string, spectator: Participant) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);
  room.spectators = room.spectators.filter((p) => p.id !== spectator.id);
  room.spectators.push({ ...spectator, role: "spectator" });
  return room;
}

function waitInQueue(user: Participant) {
  if (!waitingPlayers.some((p) => p.id === user.id)) {
    waitingPlayers.push(user);
  }
}

function matchFromQueue() {
  if (!waitingPlayers.length) return null;
  return waitingPlayers.shift() ?? null;
}

function destroyRoom(roomId: string) {
  rooms.delete(roomId);
}

export const roomManager = {
  createRoom,
  listRooms,
  joinRoom,
  leaveRoom,
  addSpectator,
  waitInQueue,
  matchFromQueue,
  destroyRoom,
  __internal: { rooms, waitingPlayers },
};
