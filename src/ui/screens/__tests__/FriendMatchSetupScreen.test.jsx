import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendMatchSetupScreen from "../FriendMatchSetupScreen.jsx";

const mockNavigate = vi.fn();
const mockCreateRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockLeaveRoom = vi.fn();

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("../../utils/roomApi.js", () => ({
  buildRoomWebSocketUrl: (roomId) => `ws://localhost/ws/p2p/${roomId}?token=test`,
  buildRoomWebSocketProtocols: () => ["mgx-auth", "test"],
  createRoom: (...args) => mockCreateRoom(...args),
  joinRoom: (...args) => mockJoinRoom(...args),
  leaveRoom: (...args) => mockLeaveRoom(...args),
  readRoomAuth: () => ({ accessToken: "test", user: { username: "Hero" } }),
}));

class MockWebSocket {
  static OPEN = 1;
  static sockets = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.listeners = {};
    this.send = vi.fn();
    this.close = vi.fn();
    MockWebSocket.sockets.push(this);
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
}

const room = {
  roomId: "ABC234",
  ownerId: "hero-1",
  phase: "waiting",
  players: [{ id: "hero-1", displayName: "Hero", ready: false, stack: 2000, bet: 0 }],
};

async function createAndOpen() {
  fireEvent.click(screen.getByRole("button", { name: /create room/i }));
  expect(await screen.findByText(/room created/i)).toBeTruthy();
  const socket = MockWebSocket.sockets.at(-1);
  await act(async () => socket.listeners.open());
  return socket;
}

async function sendState(socket, payload) {
  await act(async () => {
    socket.listeners.message({ data: JSON.stringify({ event: "state", payload }) });
  });
}

describe("FriendMatchSetupScreen", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    window.sessionStorage.clear();
    MockWebSocket.sockets = [];
    globalThis.WebSocket = MockWebSocket;
    mockCreateRoom.mockReset().mockResolvedValue(room);
    mockJoinRoom.mockReset().mockResolvedValue({ ...room, ownerId: "guest-2" });
    mockLeaveRoom.mockReset().mockResolvedValue({ closed: false });
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    cleanup();
  });

  it("advertises only the supported two-player Badugi room", () => {
    render(<FriendMatchSetupScreen language="en" />);
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio")).toHaveProperty("value", "badugi");
    expect(screen.getByLabelText(/seats/i)).toHaveProperty("value", "2");
    expect(screen.getByText(/quality-gated heads-up Badugi/i)).toBeTruthy();
  });

  it("creates an authenticated room and synchronizes with the canonical protocol", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    expect(mockCreateRoom).toHaveBeenCalledWith({
      metadata: expect.objectContaining({ variantId: "badugi" }),
    });
    expect(socket.send).toHaveBeenCalledWith('{"event":"sync","payload":{}}');
    expect(screen.getByText("ABC234")).toBeTruthy();
  });

  it("joins directly with a room code instead of reading private state first", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.change(screen.getByLabelText(/room code/i), { target: { value: "abc234" } });
    fireEvent.click(screen.getByRole("button", { name: /^join$/i }));
    expect(await screen.findByText(/joined room/i)).toBeTruthy();
    expect(mockJoinRoom).toHaveBeenCalledWith({ roomId: "abc234" });
  });

  it("renders four private cards and submits selected draw indexes", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    await sendState(socket, {
      ...room,
      roomCode: room.roomId,
      viewerId: room.ownerId,
      sequenceId: 2,
      phase: "draw_1",
      handId: "ABC234-1",
      hand: ["As", "2h", "7d", "Kc"],
      legalActions: ["draw"],
      currentTurnPlayerId: null,
      history: [],
    });
    expect(screen.getAllByTestId(/p2p-card-/)).toHaveLength(4);
    fireEvent.click(screen.getByTestId("p2p-card-1"));
    fireEvent.click(screen.getByTestId("p2p-card-3"));
    fireEvent.click(screen.getByTestId("p2p-draw"));
    expect(socket.send).toHaveBeenCalledWith(
      '{"event":"draw","payload":{"cardIndexes":[1,3]}}',
    );
  });

  it("only enables legal betting actions and shows named showdown winners", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    const players = [
      { id: "hero-1", displayName: "Hero", stack: 1980, bet: 20, ready: false },
      { id: "guest-2", displayName: "Guest", stack: 1960, bet: 40, ready: false },
    ];
    await sendState(socket, {
      ...room,
      roomCode: room.roomId,
      viewerId: room.ownerId,
      players,
      sequenceId: 3,
      phase: "bet_0",
      handId: "ABC234-1",
      pot: 60,
      toCall: 20,
      currentTurnPlayerId: "hero-1",
      legalActions: ["fold", "call", "raise"],
      config: { bigBlind: 100 },
      hand: ["As", "2h", "7d", "Kc"],
      history: [],
    });
    fireEvent.click(screen.getByTestId("p2p-call"));
    expect(socket.send).toHaveBeenCalledWith(
      '{"event":"action","payload":{"type":"call","amount":0}}',
    );
    expect(screen.getByTestId("p2p-raise").textContent).toContain("120");
    await sendState(socket, {
      roomCode: room.roomId,
      viewerId: room.ownerId,
      players,
      sequenceId: 4,
      phase: "showdown",
      pot: 0,
      legalActions: [],
      hand: ["As", "2h", "7d", "Kc"],
      showdown: { winnerIds: ["hero-1"], pot: 80, hands: { "hero-1": ["As", "2h"] } },
      history: [],
    });
    expect(screen.getByText(/Showdown winner: Hero/i)).toBeTruthy();
  });

  it("leaves the room and clears reconnect state", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    await createAndOpen();
    fireEvent.click(screen.getByTestId("p2p-leave"));
    await waitFor(() => expect(mockLeaveRoom).toHaveBeenCalledWith("ABC234"));
    expect(window.sessionStorage.getItem("mgx_friend_match_active_room_v1")).toBeNull();
  });

  it("treats an owner-closed room as terminal instead of reconnecting forever", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    await act(async () => socket.listeners.close({ code: 4004 }));

    expect(screen.getByText(/room was closed because the host left/i)).toBeTruthy();
    expect(screen.queryByText("ABC234")).toBeNull();
    expect(window.sessionStorage.getItem("mgx_friend_match_active_room_v1")).toBeNull();
    expect(MockWebSocket.sockets).toHaveLength(1);
  });
});
