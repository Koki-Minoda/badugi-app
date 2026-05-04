import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendMatchSetupScreen from "../FriendMatchSetupScreen.jsx";

const mockNavigate = vi.fn();
const mockCreateRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockGetRoomInfo = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../utils/roomApi.js", () => ({
  buildRoomWebSocketUrl: (roomId) => `ws://localhost/ws/room/${roomId}/play`,
  createRoom: (...args) => mockCreateRoom(...args),
  getRoomInfo: (...args) => mockGetRoomInfo(...args),
  joinRoom: (...args) => mockJoinRoom(...args),
}));

function getVariantRadio(value) {
  const radio = screen.getAllByRole("radio").find((input) => input.value === value);
  expect(radio, `variant radio ${value}`).toBeTruthy();
  return radio;
}

describe("FriendMatchSetupScreen", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    window.sessionStorage.clear();
    mockNavigate.mockClear();
    mockCreateRoom.mockReset();
    mockJoinRoom.mockReset();
    mockGetRoomInfo.mockReset();
    mockCreateRoom.mockResolvedValue({
      roomId: "room-test",
      phase: "waiting",
      metadata: {},
      maxPlayers: 4,
    });
    mockGetRoomInfo.mockResolvedValue({
      room_id: "room-test",
      phase: "waiting",
      players: [{ id: "host" }],
      metadata: {},
      sequence_id: 1,
    });
    mockJoinRoom.mockResolvedValue({ roomId: "room-test", players: ["host"] });
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    cleanup();
  });

  it("renders form fields, defaults Badugi, and creates a room on submit", async () => {
    render(<FriendMatchSetupScreen language="en" />);

    const badugiRadio = getVariantRadio("badugi");
    expect(badugiRadio).toHaveProperty("checked", true);

    expect(screen.getByLabelText(/seats/i)).toBeTruthy();
    expect(screen.getByLabelText(/small blind/i)).toBeTruthy();
    expect(screen.getByLabelText(/ante/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(await screen.findByText(/room created/i)).toBeTruthy();
    expect(screen.getByText("room-test")).toBeTruthy();
    expect(mockCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPlayers: 4,
        mode: "friend",
        metadata: expect.objectContaining({ variantId: "badugi" }),
      }),
    );
    expect(mockJoinRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-test",
        displayName: "Host",
      }),
    );
  });

  it("allows switching variants", () => {
    render(<FriendMatchSetupScreen language="en" />);
    const nlhRadio = screen.getByRole("radio", { name: /no-limit hold'em/i });
    fireEvent.click(nlhRadio);
    expect(nlhRadio).toHaveProperty("checked", true);
    const badugiRadio = getVariantRadio("badugi");
    expect(badugiRadio).toHaveProperty("checked", false);
  });

  it("navigates back to menu", () => {
    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/menu");
  });

  it("renders natural Japanese copy", () => {
    render(<FriendMatchSetupScreen language="ja" />);
    expect(screen.getByRole("heading", { name: "プライベート卓を作成" })).toBeTruthy();
    expect(screen.getByText("人数・スタック・ブラインド")).toBeTruthy();
    expect(screen.getByLabelText("席数")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ルームを作成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ゲーム選択へ戻る" })).toBeTruthy();
  });

  it("joins an existing room code", async () => {
    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.change(screen.getByLabelText(/room code/i), {
      target: { value: "room-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^join$/i }));

    expect(await screen.findByText(/joined room/i)).toBeTruthy();
    expect(mockGetRoomInfo).toHaveBeenCalledWith("room-test");
    expect(mockJoinRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-test",
        displayName: "Guest",
        seatHint: "1",
      }),
    );
  });

  it("connects to room websocket and displays received room events", async () => {
    const sockets = [];
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }

      addEventListener(type, handler) {
        this.listeners[type] = handler;
      }
    }
    globalThis.WebSocket = MockWebSocket;

    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(await screen.findByText(/room created/i)).toBeTruthy();
    await waitFor(() => expect(sockets).toHaveLength(1));

    await act(async () => {
      sockets[0].listeners.open();
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "room_state",
          payload: { sequenceId: 3 },
        }),
      });
    });

    expect(screen.getByText("connected")).toBeTruthy();
    expect(screen.getByText("room_state")).toBeTruthy();
    expect(screen.getByText(/seq 3/i)).toBeTruthy();
    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining("join_room"));
  });

  it("projects websocket events into live table state and sends player actions", async () => {
    const sockets = [];
    class MockWebSocket {
      constructor() {
        this.listeners = {};
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }

      addEventListener(type, handler) {
        this.listeners[type] = handler;
      }
    }
    globalThis.WebSocket = MockWebSocket;

    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(await screen.findByText(/room created/i)).toBeTruthy();

    await act(async () => {
      sockets[0].listeners.open();
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "room_state",
          payload: {
            roomId: "room-test",
            phase: "playing",
            sequenceId: 2,
            handId: "hand-1",
            players: ["local-player", "guest-player"],
            playerStates: [
              { id: "local-player", displayName: "Host", ready: true, stack: 1980, bet: 20 },
              { id: "guest-player", displayName: "Guest", ready: false, stack: 2000, bet: 0 },
            ],
          },
        }),
      });
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "updated_state",
          payload: {
            sequenceId: 3,
            handId: "hand-1",
            phase: "draw",
            pot: 40,
            stacks: { "local-player": 1980, "guest-player": 1980 },
            bets: { "local-player": 20, "guest-player": 20 },
            lastAction: { playerId: "guest-player", action: "call", amount: 20 },
          },
        }),
      });
    });

    expect(screen.getByText(/DRAW \/ Pot 40/i)).toBeTruthy();
    expect(screen.getByText("Host")).toBeTruthy();
    expect(screen.getByText("Guest")).toBeTruthy();
    expect(screen.getAllByText(/Stack 1980 \/ Bet 20/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /^ready$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^draw$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^fold$/i }));

    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining('"event":"reaction"'));
    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining('"type":"draw"'));
    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining('"type":"fold"'));
  });

  it("restores the active room after refresh and reconnects websocket", async () => {
    window.sessionStorage.setItem(
      "mgx_friend_match_active_room_v1",
      JSON.stringify({
        roomId: "room-restored",
        phase: "waiting",
        ownerId: "local-restored",
        displayName: "Host",
        players: ["local-restored"],
        websocketUrl: "ws://localhost/ws/room/room-restored/play",
      }),
    );
    const sockets = [];
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }

      addEventListener(type, handler) {
        this.listeners[type] = handler;
      }
    }
    globalThis.WebSocket = MockWebSocket;

    render(<FriendMatchSetupScreen language="en" />);
    expect(screen.getByText("room-restored")).toBeTruthy();
    expect(sockets).toHaveLength(1);

    await act(async () => {
      sockets[0].listeners.open();
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "history",
          payload: {
            events: [{ event: "action", sequenceId: 8, action: "call", amount: 20 }],
          },
        }),
      });
    });

    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining("local-restored"));
    expect(screen.getByText("action (replay)")).toBeTruthy();
    expect(screen.getByText(/latest sequence: 8/i)).toBeTruthy();
  });

  it("ignores stale sequence events and expands history replay entries", async () => {
    const sockets = [];
    class MockWebSocket {
      constructor() {
        this.listeners = {};
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }

      addEventListener(type, handler) {
        this.listeners[type] = handler;
      }
    }
    globalThis.WebSocket = MockWebSocket;

    render(<FriendMatchSetupScreen language="en" />);
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(await screen.findByText(/room created/i)).toBeTruthy();

    await act(async () => {
      sockets[0].listeners.open();
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "updated_state",
          payload: { sequenceId: 5 },
        }),
      });
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "room_state",
          payload: { sequenceId: 4 },
        }),
      });
      sockets[0].listeners.message({
        data: JSON.stringify({
          event: "history",
          payload: {
            events: [
              { event: "action", sequenceId: 6 },
              { event: "showdown", sequenceId: 7 },
            ],
          },
        }),
      });
    });

    expect(screen.getByText(/latest sequence: 7/i)).toBeTruthy();
    expect(screen.getByText(/stale ignored: 1/i)).toBeTruthy();
    expect(screen.getByText("updated_state")).toBeTruthy();
    expect(screen.queryByText("room_state")).toBeNull();
    expect(screen.getByText("action (replay)")).toBeTruthy();
    expect(screen.getByText("showdown (replay)")).toBeTruthy();
  });
});
