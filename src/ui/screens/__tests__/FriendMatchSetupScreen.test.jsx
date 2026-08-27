import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendMatchSetupScreen from "../FriendMatchSetupScreen.jsx";

const mockNavigate = vi.fn();
const mockCreateRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockLeaveRoom = vi.fn();
const mockGetRoomState = vi.fn();
const mockReadyRoom = vi.fn();
const mockActInRoom = vi.fn();
const mockDrawInRoom = vi.fn();
const { MockRoomApiError } = vi.hoisted(() => ({
  MockRoomApiError: class RoomApiError extends Error {
    constructor(message, terminalCode = null) {
      super(message);
      this.terminalCode = terminalCode;
    }
  },
}));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("../../utils/roomApi.js", () => ({
  buildRoomWebSocketUrl: (roomId) => `ws://localhost/ws/p2p/${roomId}?token=test`,
  buildRoomWebSocketProtocols: () => ["mgx-auth", "test"],
  createRoom: (...args) => mockCreateRoom(...args),
  getRoomState: (...args) => mockGetRoomState(...args),
  readyRoom: (...args) => mockReadyRoom(...args),
  actInRoom: (...args) => mockActInRoom(...args),
  drawInRoom: (...args) => mockDrawInRoom(...args),
  joinRoom: (...args) => mockJoinRoom(...args),
  leaveRoom: (...args) => mockLeaveRoom(...args),
  readRoomAuth: () => ({ accessToken: "test", user: { username: "Hero" } }),
  RoomApiError: MockRoomApiError,
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
  await waitFor(() => {
    expect(MockWebSocket.sockets).toHaveLength(1);
    expect(MockWebSocket.sockets[0].listeners.open).toBeTypeOf("function");
  });
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
    mockGetRoomState.mockReset().mockResolvedValue({ ...room, roomCode: room.roomId, sequenceId: 1 });
    mockReadyRoom.mockReset().mockResolvedValue({ ...room, roomCode: room.roomId, sequenceId: 2 });
    mockActInRoom.mockReset().mockResolvedValue({ ...room, roomCode: room.roomId, sequenceId: 3 });
    mockDrawInRoom.mockReset().mockResolvedValue({ ...room, roomCode: room.roomId, sequenceId: 4 });
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
    const drawCommand = JSON.parse(socket.send.mock.calls.at(-1)[0]);
    expect(drawCommand).toEqual({
      event: "draw",
      payload: expect.objectContaining({
        cardIndexes: [1, 3],
        commandId: expect.any(String),
        handId: "ABC234-1",
        expectedPhase: "draw_1",
      }),
    });
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
    const actionCommand = JSON.parse(socket.send.mock.calls.at(-1)[0]);
    expect(actionCommand).toEqual({
      event: "action",
      payload: expect.objectContaining({
        type: "call",
        amount: 0,
        commandId: expect.any(String),
        handId: "ABC234-1",
        expectedPhase: "bet_0",
      }),
    });
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

  it("rejects equal or older authoritative sequences", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    await sendState(socket, {
      ...room,
      roomCode: room.roomId,
      sequenceId: 8,
      phase: "bet_0",
      pot: 30,
      legalActions: [],
      hand: [],
      history: [],
    });
    await sendState(socket, {
      ...room,
      roomCode: room.roomId,
      sequenceId: 7,
      phase: "showdown",
      pot: 999,
      legalActions: [],
      hand: [],
      history: [],
    });
    expect(screen.getByText(/BET_0 \/ Pot 30/i)).toBeTruthy();
    expect(screen.queryByText(/SHOWDOWN \/ Pot 999/i)).toBeNull();
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

  it.each([
    [4001, /opened in another window/i],
    [4401, /log in to use Friend Match/i],
  ])("keeps websocket close code %i terminal", async (code, message) => {
    render(<FriendMatchSetupScreen language="en" />);
    const socket = await createAndOpen();
    await act(async () => socket.listeners.close({ code }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/^polling$/i)).toBeNull();
    expect(MockWebSocket.sockets).toHaveLength(1);
  });

  it("falls back to REST polling after bounded transient socket failures", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const firstSocket = await createAndOpen();
    vi.useFakeTimers();
    try {
      await act(async () => firstSocket.listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      const secondSocket = MockWebSocket.sockets.at(-1);
      await act(async () => secondSocket.listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      const thirdSocket = MockWebSocket.sockets.at(-1);

      mockGetRoomState.mockResolvedValue({
        ...room,
        roomCode: room.roomId,
        sequenceId: 5,
        phase: "waiting",
        legalActions: [],
        hand: [],
        history: [],
      });
      await act(async () => thirdSocket.listeners.close({ code: 1006 }));
      await act(async () => Promise.resolve());
      expect(screen.getByText(/^polling$/i)).toBeTruthy();
      expect(mockGetRoomState).toHaveBeenCalledWith(
        "ABC234",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );

      mockReadyRoom.mockResolvedValue({
        ...room,
        roomCode: room.roomId,
        sequenceId: 6,
        phase: "draw_1",
        handId: "ABC234-1",
        legalActions: ["draw"],
        hand: ["As", "2h", "7d", "Kc"],
        history: [],
      });
      fireEvent.click(screen.getByTestId("p2p-ready"));
      await act(async () => Promise.resolve());
      expect(mockReadyRoom).toHaveBeenCalledWith(
        "ABC234",
        expect.objectContaining({
          commandId: expect.any(String),
          handId: null,
          expectedPhase: "waiting",
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );

      mockDrawInRoom.mockResolvedValue({
        ...room,
        roomCode: room.roomId,
        sequenceId: 7,
        phase: "bet_1",
        currentTurnPlayerId: "hero-1",
        legalActions: ["call", "fold"],
        hand: ["3s", "2h", "7d", "Kc"],
        history: [],
      });
      fireEvent.click(screen.getByTestId("p2p-card-0"));
      fireEvent.click(screen.getByTestId("p2p-draw"));
      await act(async () => Promise.resolve());
      expect(mockDrawInRoom).toHaveBeenCalledWith(
        "ABC234",
        expect.objectContaining({
          cardIndexes: [0],
          commandId: expect.any(String),
          handId: "ABC234-1",
          expectedPhase: "draw_1",
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );

      fireEvent.click(screen.getByTestId("p2p-call"));
      await act(async () => Promise.resolve());
      expect(mockActInRoom).toHaveBeenCalledWith(
        "ABC234",
        expect.objectContaining({
          type: "call",
          amount: 0,
          commandId: expect.any(String),
          handId: "ABC234-1",
          expectedPhase: "bet_1",
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses an unacknowledged websocket commandId when REST takes over", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const firstSocket = await createAndOpen();
    await sendState(firstSocket, {
      ...room,
      roomCode: room.roomId,
      sequenceId: 2,
      phase: "bet_0",
      handId: "ABC234-1",
      currentTurnPlayerId: "hero-1",
      legalActions: ["call", "fold"],
      hand: ["As", "2h", "7d", "Kc"],
      history: [],
    });
    fireEvent.click(screen.getByTestId("p2p-call"));
    const websocketCommand = JSON.parse(firstSocket.send.mock.calls.at(-1)[0]);

    mockActInRoom.mockResolvedValue({
      ...room,
      roomCode: room.roomId,
      sequenceId: 3,
      phase: "bet_0",
      handId: "ABC234-1",
      acknowledgedCommandId: websocketCommand.payload.commandId,
      legalActions: [],
      hand: ["As", "2h", "7d", "Kc"],
      history: [],
    });
    vi.useFakeTimers();
    try {
      await act(async () => firstSocket.listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      await act(async () => MockWebSocket.sockets.at(-1).listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      await act(async () => MockWebSocket.sockets.at(-1).listeners.close({ code: 1006 }));
      await act(async () => Promise.resolve());

      expect(mockActInRoom).toHaveBeenCalledTimes(1);
      expect(mockActInRoom.mock.calls[0][1].commandId).toBe(websocketCommand.payload.commandId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replays an unacknowledged command with the same ID after websocket reconnect", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const firstSocket = await createAndOpen();
    await sendState(firstSocket, {
      ...room,
      roomCode: room.roomId,
      sequenceId: 2,
      phase: "bet_0",
      handId: "ABC234-1",
      currentTurnPlayerId: "hero-1",
      legalActions: ["call", "fold"],
      hand: ["As", "2h", "7d", "Kc"],
      history: [],
    });
    fireEvent.click(screen.getByTestId("p2p-call"));
    const originalCommand = JSON.parse(firstSocket.send.mock.calls.at(-1)[0]);

    vi.useFakeTimers();
    try {
      await act(async () => firstSocket.listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      const reconnectedSocket = MockWebSocket.sockets.at(-1);
      await act(async () => reconnectedSocket.listeners.open());
      expect(reconnectedSocket.send).toHaveBeenCalledWith(JSON.stringify(originalCommand));
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling after a terminal REST response", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    const firstSocket = await createAndOpen();
    vi.useFakeTimers();
    try {
      await act(async () => firstSocket.listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      await act(async () => MockWebSocket.sockets.at(-1).listeners.close({ code: 1006 }));
      await act(async () => vi.advanceTimersByTimeAsync(2_000));
      mockGetRoomState.mockRejectedValue(new MockRoomApiError("Room closed", 4004));
      await act(async () => MockWebSocket.sockets.at(-1).listeners.close({ code: 1006 }));
      await act(async () => Promise.resolve());

      expect(screen.getByText(/room was closed because the host left/i)).toBeTruthy();
      const callsAtClose = mockGetRoomState.mock.calls.length;
      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(mockGetRoomState).toHaveBeenCalledTimes(callsAtClose);
      expect(screen.queryByText(/^polling$/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
