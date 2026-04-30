import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendMatchSetupScreen from "../FriendMatchSetupScreen.jsx";

const mockNavigate = vi.fn();
const mockCreateRoom = vi.fn();
const mockJoinRoom = vi.fn();

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
  joinRoom: (...args) => mockJoinRoom(...args),
}));

describe("FriendMatchSetupScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateRoom.mockReset();
    mockJoinRoom.mockReset();
    mockCreateRoom.mockResolvedValue({
      roomId: "room-test",
      phase: "waiting",
      metadata: {},
      maxPlayers: 4,
    });
    mockJoinRoom.mockResolvedValue({ roomId: "room-test", players: ["host"] });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders form fields, defaults Badugi, and creates a room on submit", async () => {
    render(<FriendMatchSetupScreen />);

    const badugiRadio = screen.getByRole("radio", { name: /badugi/i });
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
    render(<FriendMatchSetupScreen />);
    const nlhRadio = screen.getByRole("radio", { name: /no-limit hold'em/i });
    fireEvent.click(nlhRadio);
    expect(nlhRadio).toHaveProperty("checked", true);
    const badugiRadio = screen.getByRole("radio", { name: /badugi/i });
    expect(badugiRadio).toHaveProperty("checked", false);
  });

  it("navigates back to menu", () => {
    render(<FriendMatchSetupScreen />);
    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/menu");
  });
});
